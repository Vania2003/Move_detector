import os, re, json, sqlite3, time
from datetime import datetime, UTC
import paho.mqtt.client as mqtt

DB_PATH = "/home/pi/DYPLOM/device/raspberry/events.db"
BROKER_HOST = "localhost"
BROKER_PORT = 1883
TOPICS = [("iot/eldercare/+/motion/#", 0)]
MQTT_USER="iot"
MQTT_PASS="iot"

def db_connect():
    return sqlite3.connect(DB_PATH, timeout=10)

def init_db_minimal():
    conn = db_connect(); cur = conn.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS messages_raw(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts_utc TEXT NOT NULL,
        topic TEXT NOT NULL,
        device_id TEXT,
        payload TEXT NOT NULL
    )""")
    cur.execute("""CREATE INDEX IF NOT EXISTS idx_raw_ts ON messages_raw(ts_utc)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS heartbeats(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts_utc TEXT NOT NULL,
        device_id TEXT NOT NULL,
        ip TEXT,
        uptime_ms INTEGER
    )""")
    cur.execute("""CREATE INDEX IF NOT EXISTS idx_hb_dev_ts ON heartbeats(device_id, ts_utc)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS motion_events(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts_utc TEXT NOT NULL,
        device_id TEXT NOT NULL,
        value INTEGER NOT NULL CHECK (value IN (0,1))
    )""")
    cur.execute("""CREATE INDEX IF NOT EXISTS idx_motion_dev_ts ON motion_events(device_id, ts_utc)""")
    conn.commit(); conn.close()

def upsert_device_and_room(conn, topic, device_id):
    m = re.match(r"^iot/eldercare/([^/]+)/", topic)
    room_name = m.group(1) if m else None
    cur = conn.cursor()
    room_id = None
    if room_name:
        cur.execute("INSERT OR IGNORE INTO rooms(name) VALUES(?)", (room_name,))
        cur.execute("SELECT id FROM rooms WHERE name=?", (room_name,))
        row = cur.fetchone()
        room_id = row[0] if row else None
    if device_id:
        cur.execute("INSERT OR IGNORE INTO devices(device_id, room_id) VALUES(?,?)",
                    (device_id, room_id))
    conn.commit()

def insert_raw(conn, ts_utc, topic, device_id, payload):
    conn.execute(
        "INSERT INTO messages_raw(ts_utc, topic, device_id, payload) VALUES(?,?,?,?)",
        (ts_utc, topic, device_id, payload))

def insert_hb(conn, ts_utc, device_id, ip, uptime_ms):
    conn.execute(
        "INSERT INTO heartbeats(ts_utc, device_id, ip, uptime_ms) VALUES(?,?,?,?)",
        (ts_utc, device_id, ip, uptime_ms))

def insert_motion(conn, ts_utc, device_id, value):
    conn.execute(
        "INSERT INTO motion_events(ts_utc, device_id, value) VALUES(?,?,?)",
        (ts_utc, device_id, int(value)))

def utc_now_naive_iso():
    return datetime.now(UTC).replace(tzinfo=None).isoformat(timespec="seconds")

def on_connect(client, userdata, flags, rc):
    print("MQTT connected rc=", rc)
    for t, q in TOPICS:
        client.subscribe(t)
        print("Subscribed:", t)

def on_message(client, userdata, msg):
    ts_utc = utc_now_naive_iso()
    payload_str = msg.payload.decode("utf-8", "ignore")
    topic = msg.topic
    print(topic, "=>", payload_str)

    device_id = None
    try:
        data = json.loads(payload_str)
        if isinstance(data, dict):
            device_id = data.get("device")
    except Exception:
        data = None

    conn = db_connect()
    try:
        insert_raw(conn, ts_utc, topic, device_id, payload_str)

        if topic.endswith("/motion/health") and isinstance(data, dict):
            dev = data.get("device")
            if dev:
                upsert_device_and_room(conn, topic, dev)
                insert_hb(conn, ts_utc, dev, data.get("ip"), data.get("uptime_ms"))

        elif topic.endswith("/motion/state") and isinstance(data, dict):
            dev = data.get("device")
            if dev is not None and "motion" in data:
                upsert_device_and_room(conn, topic, dev)
                insert_motion(conn, ts_utc, dev, 1 if bool(data["motion"]) else 0)

        conn.commit()
    except Exception as e:
        print("DB error:", e)
    finally:
        conn.close()

def main():
    if not os.path.exists(DB_PATH):
        print("DB not found, creating:", DB_PATH)
        open(DB_PATH, "a").close()
    init_db_minimal()

    client = mqtt.Client()
    client.username_pw_set(MQTT_USER, MQTT_PASS)
    client.on_connect = on_connect
    client.on_message = on_message

    while True:
        try:
            client.connect(BROKER_HOST, BROKER_PORT, 60)
            client.loop_forever()
        except Exception as e:
            print("MQTT connect error:", e)
            time.sleep(3)

if __name__ == "__main__":
    main()

