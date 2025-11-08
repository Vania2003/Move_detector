import argparse
import os
import sys
from subprocess import call, list2cmdline

PROFILES = ["morning", "day", "night", "bathroom_long", "kitchen_cooking", "random", "manual"]

def build_args(argv=None):
    p = argparse.ArgumentParser(description="Simulator launcher (batch or interactive)")
    p.add_argument("--host", default=os.getenv("MQTT_HOST", "127.0.0.1"))
    p.add_argument("--port", type=int, default=int(os.getenv("MQTT_PORT", "1883")))
    p.add_argument("--user", default=os.getenv("MQTT_USER"))
    p.add_argument("--password", default=os.getenv("MQTT_PASS"))
    p.add_argument("--room", default="living")
    p.add_argument("--device-id", default="esp_sim")
    p.add_argument("--profile", choices=PROFILES, default="")
    p.add_argument("--duration-min", type=float, default=30.0)
    p.add_argument("--time-scale", type=float, default=6.0)
    p.add_argument("--qos", type=int, choices=[0,1,2], default=1)
    p.add_argument("--seed", type=int, default=123)
    p.add_argument("--csv-out", default="")
    p.add_argument("--batch", action="store_true", help="Run with provided args, no prompts")
    return p.parse_args(argv)

def run(args):
    cmd = ["python3", "simulator_motion.py",
           "--host", args.host, "--port", str(args.port),
           "--room", args.room,
           "--device-id", args.device_id,
           "--duration-min", str(args.duration_min),
           "--time-scale", str(args.time_scale),
           "--qos", str(args.qos),
           "--seed", str(args.seed),
           ]
    if args.user: cmd += ["--user", args.user]
    if args.password: cmd += ["--password", args.password]
    if args.csv_out: cmd += ["--csv-out", args.csv_out]

    if args.batch:
        if not args.profile:
            print("[LAUNCHER] --batch requires --profile")
            sys.exit(2)
        cmd += ["--profile", args.profile]
        print("[LAUNCHER] exec:", list2cmdline(cmd))
        sys.exit(call(cmd))
    else:
        print("=== MQTT Simulation Launcher ===")
        print("MQTT host:", args.host, "port:", args.port)
        args.room = input(f"Room name [{args.room}]: ") or args.room
        args.device_id = input(f"Device id [{args.device_id}]: ") or args.device_id
        print("Profiles:", ", ".join(PROFILES))
        pick = input(f"Profile [{args.profile or 'day'}]: ") or (args.profile or "day")
        if pick not in PROFILES:
            print("Unknown profile, using 'day'")
            pick = "day"
        args.duration_min = float(input(f"Duration minutes [{args.duration_min}]: ") or args.duration_min)
        args.time_scale = float(input(f"Time scale [{args.time_scale}]: ") or args.time_scale)
        args.qos = int(input(f"QoS (0/1/2) [{args.qos}]: ") or args.qos)
        args.seed = int(input(f"Seed [{args.seed}]: ") or args.seed)
        args.csv_out = input(f"CSV output file (empty = none) [{args.csv_out}]: ") or args.csv_out

        cmd += ["--profile", pick]
        if args.csv_out: cmd += ["--csv-out", args.csv_out]

        print("[LAUNCHER] exec:", list2cmdline(cmd))
        sys.exit(call(cmd))

if __name__ == "__main__":
    run(build_args())
