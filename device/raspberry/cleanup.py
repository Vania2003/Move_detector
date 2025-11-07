import os
import sqlite3
from datetime import datetime, UTC

DB_PATH = "/home/pi/DYPLOM/device/raspberry/events.db"
RETENTION_DAYS = int(os.getenv("ALERT_RETENTION_DAYS", "7"))

def log(msg):
    print(f"[{datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        DELETE FROM alerts
        WHERE status='closed'
          AND COALESCE(closed_at, ts_utc) < datetime('now', ?);
    """, (f'-{RETENTION_DAYS} days',))
    deleted_alerts = cur.rowcount

    cur.execute("""
        DELETE FROM notifications_log
        WHERE alert_id NOT IN (SELECT id FROM alerts);
    """)
    deleted_notif = cur.rowcount

    conn.commit()

    RAW_DAYS = int(os.getenv("RAW_RETENTION_DAYS", "14"))
    cur.execute("""
        DELETE FROM messages_raw
        WHERE datetime(ts_utc) < datetime('now', ?);
    """, (f'-{RAW_DAYS} days',))
    deleted_raw = cur.rowcount

    cur.execute("""
        DELETE FROM heartbeats
        WHERE datetime(ts_utc) < datetime('now', ?);
    """, (f'-{RAW_DAYS} days',))
    deleted_hb = cur.rowcount

    cur.execute("""
        DELETE FROM motion_events
        WHERE datetime(ts_utc) < datetime('now', ?);
    """, (f'-{RAW_DAYS} days',))
    deleted_motion = cur.rowcount

    conn.commit()
    conn.execute("VACUUM")
    conn.close()

    log(f"Cleanup done: alerts={deleted_alerts}, notif_log={deleted_notif}, "
        f"raw={deleted_raw}, heartbeats={deleted_hb}, motion={deleted_motion}")

if __name__ == "__main__":
    main()

