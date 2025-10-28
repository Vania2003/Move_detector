#!/usr/bin/env python3
import sqlite3
import time
from datetime import datetime

DB_PATH = "/home/pi/DYPLOM/device/raspberry/events.db"
CHECK_INTERVAL = 15


def now_utc():
    """Return current UTC time as string for database entries."""
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def log(msg):
    """Print timestamped message to stdout."""
    print(f"[{now_utc()}] {msg}", flush=True)


def get_settings():
    """Load all rule thresholds from rule_settings table."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT key, value FROM rule_settings;")
    settings = {k: v for k, v in cur.fetchall()}
    conn.close()
    return settings


def get_rooms(conn):
    """Return all room names from rooms table."""
    cur = conn.cursor()
    try:
        cur.execute("SELECT name FROM rooms;")
    except sqlite3.OperationalError:
        cur.execute("SELECT room FROM rooms;")
    return [r[0] for r in cur.fetchall()]


def get_last_motion(conn, room):
    """Return datetime of last motion event for given room (via devices mapping)."""
    cur = conn.cursor()
    cur.execute("""
        SELECT m.ts_utc
        FROM motion_events m
        JOIN devices d ON m.device_id = d.device_id
        WHERE d.room = ?
        ORDER BY m.ts_utc DESC
        LIMIT 1;
    """, (room,))
    row = cur.fetchone()
    if not row:
        return None
    return datetime.fromisoformat(row[0])


def open_alert(conn, rule, room, details, severity="medium"):
    """Create new alert record."""
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO alerts (ts_utc, room, device_id, type, severity, details, status, rule, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (now_utc(), room, f"{room}_dev", rule, severity, details, "open", rule, now_utc()))
    conn.commit()
    log(f"⚠️  Opened alert {rule} for {room}: {details}")


def close_alert(conn, rule, room):
    """Mark alert as closed."""
    cur = conn.cursor()
    cur.execute("SELECT id FROM alerts WHERE room=? AND rule=? AND status='open';", (room, rule))
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE alerts SET status='closed', closed_at=? WHERE id=?;", (now_utc(), row[0]))
        conn.commit()
        log(f"✅ Closed alert {rule} for {room}")


def has_open_alert(conn, rule, room):
    """Check if open alert exists."""
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM alerts WHERE room=? AND rule=? AND status='open';", (room, rule))
    return cur.fetchone()[0] > 0


def check_inactivity(conn, settings, room):
    """Trigger INACTIVITY alert if no motion detected beyond thresholds."""
    day_thresh = float(settings.get("inactive.threshold_day_min", 45))
    night_thresh = float(settings.get("inactive.threshold_night_min", 60))
    night_window = settings.get("night.window", "23:00-06:00")

    last_motion = get_last_motion(conn, room)
    if not last_motion:
        return

    since = (datetime.utcnow() - last_motion).total_seconds() / 60

    start, end = [datetime.strptime(x, "%H:%M").time() for x in night_window.split("-")]
    now_t = datetime.utcnow().time()
    is_night = now_t >= start or now_t <= end
    thresh = night_thresh if is_night else day_thresh

    if since > thresh and not has_open_alert(conn, "INACTIVITY", room):
        open_alert(conn, "INACTIVITY", room, f"No motion for {since:.1f} min", "high")
    elif since <= thresh and has_open_alert(conn, "INACTIVITY", room):
        close_alert(conn, "INACTIVITY", room)


def check_dwell(conn, settings, room):
    """Detect excessive dwell time or activity in critical rooms."""
    critical_rooms = [r.strip() for r in settings.get("dwell.critical_rooms", "").split(",") if r.strip()]
    if room not in critical_rooms:
        return

    min_dwell = float(settings.get(f"dwell.{room.lower()}_min", 20))
    cur = conn.cursor()
    cur.execute("""
    SELECT COUNT(*)
    FROM motion_events m
    JOIN devices d ON m.device_id = d.device_id
    WHERE d.room = ? AND m.ts_utc >= datetime('now', ?);
    """, (room, f"-{min_dwell} minutes"))
    count = cur.fetchone()[0]

    if count > min_dwell and not has_open_alert(conn, "DWELL_CRITICAL", room):
        open_alert(conn, "DWELL_CRITICAL", room, f"High activity for {min_dwell} min", "medium")
    elif count < 1 and has_open_alert(conn, "DWELL_CRITICAL", room):
        close_alert(conn, "DWELL_CRITICAL", room)


def check_heartbeat(conn):
    """Monitor device heartbeats and open/close alerts for inactivity."""
    cur = conn.cursor()
    cur.execute("SELECT device_id, MAX(ts_utc) FROM heartbeats GROUP BY device_id;")
    rows = cur.fetchall()
    for device, ts in rows:
        try:
            last = datetime.fromisoformat(ts)
        except Exception:
            continue
        delta = (datetime.utcnow() - last).total_seconds()
        if delta > 1800:
            if not has_open_alert(conn, "NO_HEARTBEAT", device):
                open_alert(conn, "NO_HEARTBEAT", device, f"No heartbeat for {int(delta)}s", "high")
        else:
            close_alert(conn, "NO_HEARTBEAT", device)


def main():
    log("Rules Engine started.")
    while True:
        conn = sqlite3.connect(DB_PATH)
        settings = get_settings()
        rooms = get_rooms(conn)

        for room in rooms:
            check_inactivity(conn, settings, room)
            check_dwell(conn, settings, room)
        check_heartbeat(conn)

        conn.close()
        log("Cycle completed. Sleeping...\n")
        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()

