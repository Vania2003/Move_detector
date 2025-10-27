from flask import Flask, jsonify, request
import sqlite3

DB_PATH = "/home/pi/DYPLOM/device/raspberry/events.db"

app = Flask(__name__)

def query_db(query, args=(), one=False):
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.execute(query, args)
    rv = cur.fetchall()
    con.close()
    return (rv[0] if rv else None) if one else rv

@app.route("/")
def root():
    return jsonify({"status": "ok", "message": "Eldercare API active"})

@app.route("/api/messages")
def get_messages():
    limit = int(request.args.get("limit", 10))
    data = query_db("""
        SELECT ts_utc, topic, payload
        FROM messages_raw
        ORDER BY id DESC
        LIMIT ?""", (limit,))
    return jsonify([dict(row) for row in data])

@app.route("/api/devices")
def get_devices():
    data = query_db("""
        SELECT d.device_id, r.name AS room, MAX(h.ts_utc) AS last_hb
        FROM devices d
        LEFT JOIN rooms r ON r.id = d.room_id
        LEFT JOIN heartbeats h ON h.device_id = d.device_id
        GROUP BY d.device_id
        ORDER BY last_hb DESC;
    """)
    return jsonify([dict(row) for row in data])

@app.route("/api/health/latest")
def get_latest_health():
    data = query_db("""
        SELECT device_id, MAX(ts_utc) AS last_hb, MAX(uptime_ms) AS last_uptime
        FROM heartbeats
        GROUP BY device_id
        ORDER BY last_hb DESC;
    """)
    return jsonify([dict(row) for row in data])

@app.route("/api/alerts")
def get_alerts():
    data = query_db("""
        SELECT id, ts_utc, room, device_id, type, severity, status, details
        FROM alerts
        WHERE status='open'
        ORDER BY ts_utc DESC
    """)
    return jsonify([dict(row) for row in data])

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

