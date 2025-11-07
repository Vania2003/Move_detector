# /home/pi/DYPLOM/device/raspberry/rules_engine.py
import sqlite3
import time
import json
import threading
from datetime import datetime, UTC

import paho.mqtt.client as mqtt

from prealert_config import load_config, get_room_cfg, in_night_window

# ---------- Константы ----------
DB_PATH = "/home/pi/DYPLOM/device/raspberry/events.db"
CHECK_INTERVAL = 15  # сек
MQTT_HOST = "192.168.0.48"
MQTT_PORT = 1883
MQTT_USER = "iot"
MQTT_PASS = "iot"

# ---------- Глобальное состояние ----------
mqtt_client = None
config_cache = load_config()
_last_prealert_sent = {}  # {room: ts_monotonic}

# ---------- Утилиты ----------
def now_utc_str():
    return datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")

def log(msg: str):
    print(f"[{now_utc_str()}] {msg}", flush=True)

def init_mqtt_once():
    global mqtt_client
    if mqtt_client is not None:
        return
    mqttc = mqtt.Client()
    mqttc.username_pw_set(MQTT_USER, MQTT_PASS)
    mqttc.connect(MQTT_HOST, MQTT_PORT, 60)
    mqttc.loop_start()
    mqtt_client = mqttc
    log("[PREALERT] MQTT client connected and loop started")

# ---------- Доступ к БД ----------
def get_settings():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("SELECT key, value FROM rule_settings;")
    settings = {k: v for k, v in cur.fetchall()}
    con.close()
    return settings

def get_rooms(con):
    cur = con.cursor()
    try:
        cur.execute("SELECT name FROM rooms;")
    except sqlite3.OperationalError:
        cur.execute("SELECT room FROM rooms;")
    return [r[0] for r in cur.fetchall()]

def get_last_motion(con, room: str):
    """
    Возвращает последний момент движения (datetime, UTC-aware) по комнате.
    Сначала через devices (device->room), затем fallback по messages_raw topic.
    """
    cur = con.cursor()
    # 1) Через join motion_events -> devices по room
    cur.execute("""
        SELECT MAX(m.ts_utc)
          FROM motion_events m
          JOIN devices d ON m.device_id = d.device_id
         WHERE d.room = ?
    """, (room,))
    ts = cur.fetchone()[0]
    if ts:
        try:
            dt = datetime.fromisoformat(ts)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            return dt.astimezone(UTC)
        except Exception:
            pass

    # 2) Fallback: по messages_raw с topic iot/eldercare/<room>/motion/state
    cur.execute("""
        SELECT MAX(ts_utc)
          FROM messages_raw
         WHERE topic = ?
    """, (f"iot/eldercare/{room}/motion/state",))
    ts2 = cur.fetchone()[0]
    if ts2:
        try:
            dt2 = datetime.fromisoformat(ts2)
            if dt2.tzinfo is None:
                dt2 = dt2.replace(tzinfo=UTC)
            return dt2.astimezone(UTC)
        except Exception:
            pass

    return None

# ---------- Операции с алертами ----------
def open_alert(con, rule, room, details, severity="medium"):
    cur = con.cursor()
    cur.execute("""
        INSERT INTO alerts (ts_utc, room, device_id, type, severity, details, status, rule, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (now_utc_str(), room, f"{room}_dev", rule, severity, details, "open", rule, now_utc_str()))
    con.commit()
    log(f"⚠️  Opened alert {rule} for {room}: {details}")

def close_alert(con, rule, room):
    cur = con.cursor()
    cur.execute("SELECT id FROM alerts WHERE room=? AND rule=? AND status='open';", (room, rule))
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE alerts SET status='closed', closed_at=? WHERE id=?;", (now_utc_str(), row[0]))
        con.commit()
        log(f"✅ Closed alert {rule} for {room}")

def has_open_alert_room(con, rule, room):
    cur = con.cursor()
    cur.execute("SELECT COUNT(*) FROM alerts WHERE room=? AND rule=? AND status='open';", (room, rule))
    return cur.fetchone()[0] > 0

def open_alert_room(con, rule, room, details, severity="medium"):
    cur = con.cursor()
    cur.execute("""
        INSERT INTO alerts (ts_utc, room, device_id, type, severity, details, status, rule, created_at)
        VALUES (?, ?, NULL, ?, ?, ?, 'open', ?, ?);
    """, (now_utc_str(), room, rule, severity, details, rule, now_utc_str()))
    con.commit()
    log(f"⚠️  Opened alert {rule} for room={room}: {details}")

def close_alert_room(con, rule, room):
    cur = con.cursor()
    cur.execute("SELECT id FROM alerts WHERE room=? AND rule=? AND status='open';", (room, rule))
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE alerts SET status='closed', closed_at=? WHERE id=?;", (now_utc_str(), row[0]))
        con.commit()
        log(f"✅ Closed alert {rule} for room={room}")

def has_open_alert_device(con, rule, device_id):
    cur = con.cursor()
    cur.execute("SELECT COUNT(*) FROM alerts WHERE device_id=? AND rule=? AND status='open';", (device_id, rule))
    return cur.fetchone()[0] > 0

def open_alert_device(con, rule, device_id, details, severity="medium"):
    cur = con.cursor()
    cur.execute("""
        INSERT INTO alerts (ts_utc, room, device_id, type, severity, details, status, rule, created_at)
        VALUES (?, NULL, ?, ?, ?, ?, 'open', ?, ?);
    """, (now_utc_str(), device_id, rule, severity, details, rule, now_utc_str()))
    con.commit()
    log(f"⚠️  Opened alert {rule} for device={device_id}: {details}")

def close_alert_device(con, rule, device_id):
    cur = con.cursor()
    cur.execute("SELECT id FROM alerts WHERE device_id=? AND rule=? AND status='open';", (device_id, rule))
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE alerts SET status='closed', closed_at=? WHERE id=?;", (now_utc_str(), row[0]))
        con.commit()
        log(f"✅ Closed alert {rule} for device={device_id}")

# ---------- Преалерт MQTT ----------
def publish_prealert_start(room, ttl_sec=300):
    topic = f"iot/eldercare/{room}/cmd/prealert"
    payload = {"action": "start", "reason": "INACTIVITY", "ttl_sec": ttl_sec}
    mqtt_client.publish(topic, json.dumps(payload), qos=0, retain=False)
    log(f"[PREALERT] publish start → {topic} {json.dumps(payload)}")

def publish_prealert_stop(room):
    topic = f"iot/eldercare/{room}/cmd/prealert"
    payload = {"action": "stop", "reason": "INACTIVITY"}
    mqtt_client.publish(topic, json.dumps(payload), qos=0, retain=False)
    log(f"[PREALERT] publish stop  → {topic} {json.dumps(payload)}")

def maybe_send_prealert(room: str, now_epoch: float, last_motion_epoch: float):
    cfg = get_room_cfg(room, config_cache)
    if not cfg.get("enabled", True):
        return
    if in_night_window(cfg):
        return

    inactivity = int(cfg.get("inactivity_sec", 30 * 60))
    pre_offset = int(cfg.get("prealert_offset_sec", 5 * 60))
    elapsed = now_epoch - last_motion_epoch

    # окно пред-алерта
    if not (inactivity - pre_offset <= elapsed < inactivity):
        return

    # анти-спам (не чаще раза в 120 сек)
    last = _last_prealert_sent.get(room)
    if last and (time.monotonic() - last) < 120:
        return

    ttl = int(max(1, inactivity - elapsed))
    publish_prealert_start(room, ttl_sec=ttl)
    _last_prealert_sent[room] = time.monotonic()

# ---------- Правила ----------
def check_inactivity(con, settings, room):
    cfg = get_room_cfg(room, config_cache)
    if not cfg.get("enabled", True):
        return

    last_motion = get_last_motion(con, room)
    if not last_motion:
        log(f"[PREALERT] no motion record found for {room}")
        return

    now = datetime.now(UTC)
    if last_motion.tzinfo is None:
        last_motion = last_motion.replace(tzinfo=UTC)
    elapsed = (now - last_motion).total_seconds()

    inactivity = int(cfg.get("inactivity_sec", 30 * 60))
    pre_offset = int(cfg.get("prealert_offset_sec", 5 * 60))
    start_window = inactivity - pre_offset

    log(f"[DEBUG] room={room} elapsed={elapsed:.1f}s (inactivity={inactivity}, prealert_offset={pre_offset})")

    # Триггер пред-алерта
    if start_window <= elapsed < inactivity and not in_night_window(cfg):
        ttl = int(max(1, inactivity - elapsed))
        publish_prealert_start(room, ttl_sec=ttl)

    # Открытие/закрытие INACTIVITY
    if elapsed > inactivity and not has_open_alert_room(con, "INACTIVITY", room):
        minutes = elapsed / 60.0
        open_alert_room(con, "INACTIVITY", room, f"No motion for {minutes:.1f} min", "high")
        publish_prealert_stop(room)
    elif elapsed <= start_window and has_open_alert_room(con, "INACTIVITY", room):
        close_alert_room(con, "INACTIVITY", room)
        publish_prealert_stop(room)

def check_dwell(con, settings, room):
    critical_rooms = [r.strip() for r in settings.get("dwell.critical_rooms", "").split(",") if r.strip()]
    if room not in critical_rooms:
        return
    min_dwell = float(settings.get(f"dwell.{room.lower()}_min", 20))
    cur = con.cursor()
    cur.execute("""
        SELECT COUNT(*)
          FROM motion_events m
          JOIN devices d ON m.device_id = d.device_id
         WHERE d.room = ?
           AND m.ts_utc >= datetime('now', ?);
    """, (room, f"-{int(min_dwell)} minutes"))
    count = cur.fetchone()[0]

    if count > min_dwell and not has_open_alert_room(con, "DWELL_CRITICAL", room):
        open_alert_room(con, "DWELL_CRITICAL", room, f"High activity for {int(min_dwell)} min", "medium")
    elif count < 1 and has_open_alert_room(con, "DWELL_CRITICAL", room):
        close_alert_room(con, "DWELL_CRITICAL", room)

def check_heartbeat(con):
    cur = con.cursor()
    cur.execute("SELECT device_id, MAX(ts_utc) FROM heartbeats GROUP BY device_id;")
    rows = cur.fetchall()
    for device, ts in rows:
        if not ts:
            continue
        try:
            last = datetime.fromisoformat(ts)
            if last.tzinfo is None:
                last = last.replace(tzinfo=UTC)
            last = last.astimezone(UTC)
        except Exception:
            continue
        delta = (datetime.now(UTC) - last).total_seconds()
        if delta > 1800:
            if not has_open_alert_device(con, "NO_HEARTBEAT", device):
                open_alert_device(con, "NO_HEARTBEAT", device, f"No heartbeat for {int(delta)}s", "high")
        else:
            if has_open_alert_device(con, "NO_HEARTBEAT", device):
                close_alert_device(con, "NO_HEARTBEAT", device)

# ---------- Главный цикл ----------
def main():
    log("Rules Engine started.")
    init_mqtt_once()

    while True:
        con = sqlite3.connect(DB_PATH)
        try:
            settings = get_settings()
            rooms = get_rooms(con)

            for room in rooms:
                check_inactivity(con, settings, room)
                check_dwell(con, settings, room)

                # Отправка пред-алерта на основе последнего движения (в секундах)
                last = get_last_motion(con, room)
                if last:
                    now_epoch = time.time()
                    last_epoch = last.timestamp()
                    maybe_send_prealert(room, now_epoch, last_epoch)

            check_heartbeat(con)
        finally:
            con.close()

        log("Cycle completed. Sleeping...\n")
        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    # Без дополнительных потоков: один главный цикл достаточно
    main()

