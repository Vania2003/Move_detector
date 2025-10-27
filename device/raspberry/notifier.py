#!/usr/bin/env python3
import os
import time
import sqlite3
import smtplib
from datetime import datetime
from email.mime.text import MIMEText

DB_PATH = "/home/pi/DYPLOM/device/raspberry/events.db"
CHECK_INTERVAL = 60  # seconds

def log(msg):
    """Print log message with timestamp (visible in journalctl)."""
    print(f"[{datetime.utcnow().isoformat(timespec='seconds')}] {msg}", flush=True)

def get_open_alerts(conn):
    """Return all open alerts that have not been notified yet."""
    query = """
        SELECT id, rule, room, details, severity, ts_utc
        FROM alerts
        WHERE status='open' AND (notified_at IS NULL OR notified_at='')
        ORDER BY id DESC;
    """
    return conn.execute(query).fetchall()

def mark_notified(conn, alert_id, ok, details):
    """Record notification attempt in notifications_log and update alerts table."""
    conn.execute("""
        INSERT INTO notifications_log (alert_id, channel, ok, details)
        VALUES (?, 'email', ?, ?);
    """, (alert_id, 1 if ok else 0, details))
    if ok:
        conn.execute("UPDATE alerts SET notified_at = datetime('now') WHERE id = ?", (alert_id,))
    conn.commit()

def send_email(alert, smtp_cfg):
    """Send alert email using SMTP configuration."""
    subject = f"[ALERT] {alert['rule']} ({alert['severity']})"
    body = (
        f"Rule: {alert['rule']}\n"
        f"Room: {alert['room']}\n"
        f"Time (UTC): {alert['ts_utc']}\n"
        f"Severity: {alert['severity']}\n"
        f"Details: {alert['details']}\n"
    )

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = smtp_cfg["SMTP_USER"]
    msg["To"] = smtp_cfg["ALERT_EMAIL"]

    try:
        server = smtplib.SMTP(smtp_cfg["SMTP_HOST"], int(smtp_cfg["SMTP_PORT"]))
        server.starttls()
        server.login(smtp_cfg["SMTP_USER"], smtp_cfg["SMTP_PASS"])
        server.sendmail(smtp_cfg["SMTP_USER"], [smtp_cfg["ALERT_EMAIL"]], msg.as_string())
        server.quit()
        return True, "Email sent successfully"
    except Exception as e:
        return False, f"Email failed: {e}"

def main():
    smtp_cfg = {
        "SMTP_HOST": os.getenv("SMTP_HOST"),
        "SMTP_PORT": os.getenv("SMTP_PORT", "587"),
        "SMTP_USER": os.getenv("SMTP_USER"),
        "SMTP_PASS": os.getenv("SMTP_PASS"),
        "ALERT_EMAIL": os.getenv("ALERT_EMAIL"),
    }

    log("Notifier started (email-only mode)")
    log(f"SMTP target: {smtp_cfg['ALERT_EMAIL']} via {smtp_cfg['SMTP_HOST']}")

    while True:
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row

            alerts = get_open_alerts(conn)
            if not alerts:
                log("No new alerts to notify.")
            else:
                log(f"Found {len(alerts)} new alert(s) to process.")
                for alert in alerts:
                    log(f"Sending email for alert #{alert['id']} ({alert['rule']})...")
                    ok, info = send_email(alert, smtp_cfg)
                    mark_notified(conn, alert["id"], ok, info)
                    log(f"Result: {info}")

            conn.close()
        except Exception as e:
            log(f"[ERROR] {e}")

        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    main()

