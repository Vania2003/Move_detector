import argparse
import csv
import json
import os
import random
import socket
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import Iterator, Tuple, Optional

try:
    import paho.mqtt.client as mqtt
except ImportError as e:
    print("paho-mqtt is required. Install with: pip install paho-mqtt", file=sys.stderr)
    raise

ISO = "%Y-%m-%dT%H:%M:%S"
DEF_HB_SEC = 60

def now_iso() -> str:
    return datetime.utcnow().strftime(ISO)


def sleep_scaled(seconds: float, time_scale: float) -> None:
    """Sleep real-time by seconds / time_scale, but clamp to >= 1ms."""
    real = max(0.001, seconds / max(0.001, time_scale))
    time.sleep(real)


def mqtt_connect(host: str, port: int, user: Optional[str], password: Optional[str], client_id: str) -> mqtt.Client:
    client = mqtt.Client(client_id=client_id, clean_session=True)
    if user:
        client.username_pw_set(user, password or "")
    client.connect(host, port, keepalive=60)
    client.loop_start()
    return client


def publish_motion(client: mqtt.Client, room: str, device_id: str, motion: bool, qos: int):
    topic = f"iot/eldercare/{room}/motion/state"
    payload = {"motion": bool(motion), "device": device_id, "timestamp": now_iso()}
    client.publish(topic, json.dumps(payload), qos=qos, retain=False)


def publish_hb(client: mqtt.Client, room: str, device_id: str, uptime_ms: int, qos: int):
    topic = f"iot/eldercare/{room}/motion/health"
    payload = {
        "device": device_id,
        "ip": get_local_ip(),
        "uptime_ms": int(uptime_ms),
        "timestamp": now_iso(),
    }
    client.publish(topic, json.dumps(payload), qos=qos, retain=False)


def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        try:
            s.close()
        except Exception:
            pass
    return ip

def profile_morning(duration_sec: int, rng: random.Random) -> Iterator[Tuple[int, bool]]:
    t = 0
    while t < duration_sec:
        on = 10 + rng.randint(-2, 2)
        off = 50 + rng.randint(-5, 5)
        for _ in range(max(1, on)):
            if t >= duration_sec: break
            yield (t, True); t += 1
        for _ in range(max(1, off)):
            if t >= duration_sec: break
            yield (t, False); t += 1


def profile_day(duration_sec: int, rng: random.Random) -> Iterator[Tuple[int, bool]]:
    t = 0
    while t < duration_sec:
        idle = 180 + rng.randint(-30, 30)
        for _ in range(max(1, idle)):
            if t >= duration_sec: break
            yield (t, False); t += 1
        burst = 5 + rng.randint(-1, 2)
        for _ in range(max(1, burst)):
            if t >= duration_sec: break
            yield (t, True); t += 1


def profile_night(duration_sec: int, rng: random.Random) -> Iterator[Tuple[int, bool]]:
    t = 0
    while t < duration_sec:
        idle = 900 + rng.randint(-120, 120)
        for _ in range(max(1, idle)):
            if t >= duration_sec: break
            yield (t, False); t += 1
        wake = 3 + rng.randint(0, 2)
        for _ in range(max(1, wake)):
            if t >= duration_sec: break
            yield (t, True); t += 1


def profile_bathroom_long(duration_sec: int, rng: random.Random) -> Iterator[Tuple[int, bool]]:
    t = 0
    while t < duration_sec:
        yield (t, True)
        t += 1


def profile_kitchen_cooking(duration_sec: int, rng: random.Random) -> Iterator[Tuple[int, bool]]:
    t = 0
    while t < duration_sec:
        for _ in range(20 + rng.randint(-3, 3)):
            if t >= duration_sec: break
            yield (t, True); t += 1
        for _ in range(40 + rng.randint(-5, 5)):
            if t >= duration_sec: break
            yield (t, False); t += 1


def profile_random(duration_sec: int, rng: random.Random) -> Iterator[Tuple[int, bool]]:
    t = 0
    state = False
    while t < duration_sec:
        chunk = rng.randint(2, 120)
        for _ in range(chunk):
            if t >= duration_sec: break
            yield (t, state); t += 1
        state = not state


def profile_manual(duration_sec: int, rng: random.Random) -> Iterator[Tuple[int, bool]]:
    for t in range(duration_sec):
        yield (t, False)


PROFILES = {
    "morning": profile_morning,
    "day": profile_day,
    "night": profile_night,
    "bathroom_long": profile_bathroom_long,
    "kitchen_cooking": profile_kitchen_cooking,
    "random": profile_random,
    "manual": profile_manual,
}


def run_simulation(args):
    rng = random.Random(args.seed if args.seed is not None else None)

    duration_sec = int(args.duration_min * 60)
    client_id = f"sim_{args.device_id}_{int(time.time())}"
    client = mqtt_connect(args.host, args.port, args.user, args.password, client_id)

    csv_writer = None
    csv_file = None
    if args.csv_out:
        csv_file = open(args.csv_out, "w", newline="", encoding="utf-8")
        csv_writer = csv.writer(csv_file)
        csv_writer.writerow(["ts_utc", "room", "device", "event", "value", "note"])

    print(f"[SIM] profile={args.profile} duration={args.duration_min}min room={args.room} "
          f"device={args.device_id} time_scale={args.time_scale} qos={args.qos}")

    gen = PROFILES[args.profile](duration_sec, rng)
    last_motion = None
    uptime_ms = 0
    hb_next = DEF_HB_SEC

    start_real = time.time()
    for sim_t, motion in gen:
        if sim_t >= hb_next:
            publish_hb(client, args.room, args.device_id, uptime_ms, args.qos)
            if csv_writer:
                csv_writer.writerow([now_iso(), args.room, args.device_id, "heartbeat", "", "simulated"])
            hb_next += DEF_HB_SEC

        if last_motion is None or motion != last_motion:
            publish_motion(client, args.room, args.device_id, motion, args.qos)
            if csv_writer:
                csv_writer.writerow([now_iso(), args.room, args.device_id, "motion", str(bool(motion)), "edge"])
            print(f"[SIM] t={sim_t:>5}s motion={int(motion)}")
            last_motion = motion

        uptime_ms += int(1000 / max(0.001, args.time_scale))
        sleep_scaled(1.0, args.time_scale)

    publish_hb(client, args.room, args.device_id, uptime_ms, args.qos)
    if csv_writer:
        csv_writer.writerow([now_iso(), args.room, args.device_id, "heartbeat", "", "final"])

    elapsed = time.time() - start_real
    print(f"[SIM] done in real {elapsed:.1f}s, simulated {duration_sec}s")

    if csv_file:
        csv_file.close()
    client.loop_stop()
    client.disconnect()


def build_args(argv=None):
    p = argparse.ArgumentParser(description="MQTT motion/heartbeat simulator")
    p.add_argument("--host", default=os.getenv("MQTT_HOST", "127.0.0.1"))
    p.add_argument("--port", type=int, default=int(os.getenv("MQTT_PORT", "1883")))
    p.add_argument("--user", default=os.getenv("MQTT_USER"))
    p.add_argument("--password", default=os.getenv("MQTT_PASS"))
    p.add_argument("--room", required=True, help="Room name (e.g., kitchen)")
    p.add_argument("--device-id", default="esp_sim", help="Simulated device id")
    p.add_argument("--profile", choices=sorted(PROFILES.keys()), default="day")
    p.add_argument("--duration-min", type=float, default=30.0)
    p.add_argument("--time-scale", type=float, default=6.0, help="speedup factor. 6 => 1 sim min = 10s real")
    p.add_argument("--qos", type=int, choices=[0,1,2], default=1)
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--csv-out", default="", help="Optional CSV path to store emitted events")
    return p.parse_args(argv)


if __name__ == "__main__":
    args = build_args()
    try:
        run_simulation(args)
    except KeyboardInterrupt:
        print("\n[SIM] interrupted")
        sys.exit(130)
