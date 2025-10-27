import time
import json
import random
import paho.mqtt.publish as publish
from datetime import datetime
from colorama import Fore, Style, init

init(autoreset=True)

MQTT_HOST = "localhost"
TOPIC_TEMPLATE = "iot/eldercare/{room}/motion/state"
MQTT_USER = "iot"
MQTT_PASS = "iot"


def log(msg, color=Fore.WHITE):
    now = datetime.now().strftime("%H:%M:%S")
    print(color + f"[{now}] {msg}" + Style.RESET_ALL, flush=True)

def send_motion(room, motion, device_id):
    payload = json.dumps({
        "device": device_id,
        "motion": bool(motion),
        "ts": datetime.utcnow().isoformat(timespec="seconds")
    })
    topic = TOPIC_TEMPLATE.format(room=room)
    publish.single(topic, payload, hostname=MQTT_HOST, auth={'username': MQTT_USER, 'password': MQTT_PASS})
    log(f"Sent {payload} → {topic}",
        Fore.GREEN if motion else Fore.CYAN)

def simulate_profile(room, device_id, profile, duration_min):
    start = time.time()
    log(f"Starting profile '{profile}' for {duration_min} min", Fore.YELLOW)

    if profile == "morning":
        pattern = [(True, 60), (False, 120)] * 10
    elif profile == "day":
        pattern = [(True, 30), (False, 180)] * 20
    elif profile == "night":
        pattern = [(False, 300)] * 12
    elif profile == "bathroom_long":
        pattern = [(True, 60)] * int((duration_min * 60) / 60)
    elif profile == "kitchen_cooking":
        pattern = [(True, 30), (False, 30)] * int((duration_min * 60) / 60)
    elif profile == "random":
        pattern = [(random.choice([True, False]), random.randint(10, 120)) for _ in range(60)]
    else:
        log("Unknown profile!", Fore.RED)
        return

    for motion, wait in pattern:
        if time.time() - start > duration_min * 60:
            break
        send_motion(room, motion, device_id)
        time.sleep(wait)

    log("Profile simulation complete.", Fore.YELLOW)

def manual_mode(room, device_id):
    log("Entering manual control mode. Type 'on', 'off', or 'exit'.", Fore.MAGENTA)
    while True:
        cmd = input(Fore.BLUE + "> ").strip().lower()
        if cmd in ("exit", "quit"):
            break
        elif cmd == "on":
            send_motion(room, True, device_id)
        elif cmd == "off":
            send_motion(room, False, device_id)
        else:
            print("Commands: on / off / exit")

def main():
    while True:
        print(Fore.CYAN + "\n=== Eldercare Activity Simulator ===")
        room = input("Room name: ") or "TestRoom"
        device_id = input("Device ID: ") or "dev_test"

        print("""
Choose mode:
1) Morning routine
2) Day active
3) Night calm
4) Bathroom long stay
5) Kitchen cooking
6) Random noise
7) Manual control
8) Exit
""")
        choice = input("Select option: ").strip()
        if choice == "8":
            print("Exiting simulator.")
            break

        if choice == "7":
            manual_mode(room, device_id)
        else:
            profiles = {
                "1": "morning",
                "2": "day",
                "3": "night",
                "4": "bathroom_long",
                "5": "kitchen_cooking",
                "6": "random"
            }
            profile = profiles.get(choice, "random")
            duration = float(input("Duration (minutes): ") or 5)
            simulate_profile(room, device_id, profile, duration)

if __name__ == "__main__":
    main()

