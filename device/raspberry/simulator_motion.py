import time
import json
import random
from datetime import datetime
import paho.mqtt.publish as publish

MQTT_HOST = "127.0.0.1"
MQTT_PORT = 1883
MQTT_USER = "iot"
MQTT_PASS = "iot"
TOPIC_TEMPLATE = "iot/eldercare/{room}/motion/state"

def send_motion(room, motion, device_id):
    payload = json.dumps({
        "device": device_id,
        "motion": bool(motion),
        "ts": datetime.utcnow().isoformat(timespec="seconds")
    })
    topic = TOPIC_TEMPLATE.format(room=room)
    publish.single(
        topic,
        payload,
        hostname=MQTT_HOST,
        port=MQTT_PORT,
        auth={"username": MQTT_USER, "password": MQTT_PASS}
    )
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Sent {payload} -> {topic}", flush=True)

def profile_steps(profile, duration_min):
    if profile == "morning":
        return [(True, 60), (False, 120)] * 10
    if profile == "day":
        return [(True, 30), (False, 180)] * 20
    if profile == "night":
        return [(False, 300)] * 12
    if profile == "bathroom_long":
        return [(True, 60)] * int((duration_min * 60) / 60)
    if profile == "kitchen_cooking":
        return [(True, 30), (False, 30)] * int((duration_min * 60) / 60)
    if profile == "random":
        return [(random.choice([True, False]), random.randint(10, 120)) for _ in range(60)]
    return [(True, 10), (False, 20)] * int((duration_min * 60) / 30)

def run_interactive():
    while True:
        print("\n=== Eldercare Activity Simulator ===")
        room = input("Room name [room1]: ").strip() or "room1"
        device_id = input("Device ID [esp8266_test]: ").strip() or "esp8266_test"
        print("""
Choose mode:
1) Morning routine
2) Day active
3) Night calm
4) Bathroom long stay
5) Kitchen cooking
6) Random noise
7) Manual (type on/off)
8) Exit
""")
        choice = (input("Select option: ").strip() or "6")
        if choice == "8":
            break

        if choice == "7":
            print("Manual mode: type 'on', 'off', 'exit'")
            while True:
                cmd = input("> ").strip().lower()
                if cmd in ("exit", "quit"): break
                if cmd == "on":  send_motion(room, True, device_id)
                elif cmd == "off": send_motion(room, False, device_id)
                else: print("Commands: on/off/exit")
            continue

        mapping = {
            "1": "morning", "2": "day", "3": "night",
            "4": "bathroom_long", "5": "kitchen_cooking", "6": "random"
        }
        profile = mapping.get(choice, "random")
        try:
            duration = float(input("Duration (minutes) [5]: ").strip() or "5")
        except ValueError:
            duration = 5.0

        deadline = time.time() + duration * 60
        steps = profile_steps(profile, duration)
        for motion, wait in steps:
            if time.time() > deadline:
                break
            send_motion(room, motion, device_id)
            time.sleep(wait)

if __name__ == "__main__":
    run_interactive()

