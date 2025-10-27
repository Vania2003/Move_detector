from flask import Flask, jsonify, request, abort
import sqlite3, os
from datetime import datetime

DB_PATH = "/home/pi/DYPLOM/device/raspberry/events.db"

app = Flask(__name__)
API_TOKEN = os.getenv("API_TOKEN", "").strip()

# ---------- Utils ----------

def now_iso():
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

def row_query(query, args=(), one=False):
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.execute(query, args)
    rows = cur.fetchall()
    con.close()
    return (rows[0] if rows else None) if one else rows

# оставляем для совместимости (возвращает lastrowid, как раньше)
def exec_query(query, args=()):
    con = sqlite3.connect(DB_PATH)
    cur = con.execute(query, args)
    con.commit()
    last_id = cur.lastrowid
    con.close()
    return last_id

# корректная запись с количеством затронутых строк
def exec_write(query, args=()):
    con = sqlite3.connect(DB_PATH)
    cur = con.execute(query, args)
    con.commit()
    affected = cur.rowcount
    last_id = cur.lastrowid
    con.close()
    return affected, last_id

def require_token():
    if not API_TOKEN:
        return  # открытый режим
    hdr = request.headers.get("Authorization", "")
    key = request.headers.get("X-API-Key", "")
    token = ""
    if hdr.startswith("Bearer "):
        token = hdr.split(" ", 1)[1].strip()
    elif key:
        token = key.strip()
    if token != API_TOKEN:
        abort(401, description="Unauthorized")

@app.after_request
def add_cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-API-Key"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, OPTIONS"
    return resp

# ---------- Routes ----------

@app.route("/", methods=["GET"])
def root():
    return jsonify({"status": "ok", "message": "Eldercare API active"})

@app.route("/api/messages", methods=["GET"])
def get_messages():
    require_token()
    limit = int(request.args.get("limit", 10))
    data = row_query(
        """
        SELECT ts_utc, topic, payload
          FROM messages_raw
      ORDER BY id DESC
         LIMIT ?
        """,
        (limit,),
    )
    return jsonify([dict(r) for r in data])

@app.route("/api/health/latest", methods=["GET"])
def get_latest_health():
    require_token()
    data = row_query(
        """
        SELECT device_id, MAX(ts_utc) AS last_hb, MAX(uptime_ms) AS last_uptime
          FROM heartbeats
      GROUP BY device_id
      ORDER BY last_hb DESC;
        """
    )
    return jsonify([dict(r) for r in data])

@app.route("/api/devices", methods=["GET"])
def get_devices():
    require_token()
    data = row_query(
        """
        SELECT d.device_id,
               d.room AS room,
               (SELECT MAX(ts_utc) FROM heartbeats h WHERE h.device_id = d.device_id) AS last_hb
          FROM devices d
      ORDER BY last_hb DESC;
        """
    )
    return jsonify([dict(r) for r in data])

@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    require_token()
    status = request.args.get("status")             # 'open' | 'closed' | None
    room_contains = request.args.get("room")        # подстрока (LIKE)
    a_type = request.args.get("type")               # точное совпадение
    since = request.args.get("since")               # 'YYYY-MM-DD HH:MM:SS' или 'YYYY-MM-DDTHH:MM:SS'
    last_minutes = request.args.get("last_minutes", type=int) or 0
    limit = int(request.args.get("limit", 500))

    sql = """
      SELECT id, ts_utc, room, device_id, type, severity, status, details,
             created_at, closed_at, ack_at, ack_by, notified_at
        FROM alerts
       WHERE 1=1
    """
    args = []

    if status in ("open", "closed"):
        sql += " AND status = ?"
        args.append(status)

    if room_contains:
        sql += " AND (room IS NOT NULL AND room LIKE ?)"
        args.append(f"%{room_contains}%")

    if a_type:
        sql += " AND type = ?"
        args.append(a_type)

    if last_minutes > 0:
        sql += " AND datetime(ts_utc) >= datetime('now', ?)"
        args.append(f"-{last_minutes} minutes")
    elif since:
        sql += " AND ts_utc >= ?"
        args.append(since)

    sql += " ORDER BY id DESC LIMIT ?"
    args.append(limit)

    data = row_query(sql, tuple(args))
    return jsonify([dict(r) for r in data])

@app.route("/api/alerts/<int:alert_id>/ack", methods=["POST"])
def ack_alert(alert_id):
    require_token()
    who = (request.json or {}).get("by") or "api"
    affected, _ = exec_write(
        """
        UPDATE alerts
           SET ack_at = ?, ack_by = ?
         WHERE id = ? AND status = 'open' AND ack_at IS NULL
        """,
        (now_iso(), who, alert_id),
    )
    return jsonify({"ok": True, "updated": affected > 0})

@app.route("/api/alerts/<int:alert_id>/close", methods=["POST"])
def close_alert(alert_id):
    require_token()
    affected, _ = exec_write(
        """
        UPDATE alerts
           SET status = 'closed', closed_at = ?
         WHERE id = ? AND status != 'closed'
        """,
        (now_iso(), alert_id),
    )
    return jsonify({"ok": True, "updated": affected > 0})

# ---------- Extra: rule_settings ----------

@app.route("/api/rule-settings", methods=["GET"])
def get_rule_settings():
    require_token()
    rows = row_query("SELECT key, value FROM rule_settings ORDER BY key")
    return jsonify({r["key"]: r["value"] for r in rows})

@app.route("/api/rule-settings", methods=["PUT", "POST"])
def upsert_rule_settings():
    require_token()
    if not request.is_json:
        abort(400, description="JSON required")
    payload = request.get_json() or {}
    if not isinstance(payload, dict):
        abort(400, description="Expected object with key:value pairs")

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    for k, v in payload.items():
        cur.execute(
            """
            INSERT INTO rule_settings(key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value
            """,
            (str(k), str(v)),
        )
    con.commit()
    con.close()
    return jsonify({"ok": True, "updated": len(payload)})

# ---------- Extra: bulk close alerts ----------

@app.post("/api/alerts/close-bulk")
def close_bulk():
    require_token()
    status = request.args.get("status", "open")              # фильтр статуса
    older_than_minutes = request.args.get("older_than_minutes", type=int) or 0
    a_type = request.args.get("type")                        # опционально: ограничить тип
    args = []
    sql = "UPDATE alerts SET status='closed', closed_at=? WHERE 1=1"
    now = now_iso()
    args.append(now)

    if status in ("open", "closed"):
        sql += " AND status=?"
        args.append(status)

    if older_than_minutes > 0:
        sql += " AND datetime(ts_utc) <= datetime('now', ?)"
        args.append(f"-{older_than_minutes} minutes")

    if a_type:
        sql += " AND type=?"
        args.append(a_type)

    affected, _ = exec_write(sql, tuple(args))
    return jsonify({"ok": True, "closed": affected, "closed_at": now})

# ---------- Main ----------

if __name__ == "__main__":
    # локальный запуск: python3 app.py
    app.run(host="0.0.0.0", port=5000)
