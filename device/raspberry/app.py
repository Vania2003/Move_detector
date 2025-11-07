from flask import Flask, jsonify, request, abort
import sqlite3, os, time, json
from datetime import datetime
from flask import make_response
from prealert_config import load_config, save_config, get_room_cfg

DB_PATH = "/home/pi/DYPLOM/device/raspberry/events.db"

app = Flask(__name__)
API_TOKEN = os.getenv("API_TOKEN", "").strip()

def log(msg):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

def now_iso():
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

def row_query(query, args=(), one=False):
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.execute(query, args)
    rows = cur.fetchall()
    con.close()
    return (rows[0] if rows else None) if one else rows

def exec_query(query, args=()):
    con = sqlite3.connect(DB_PATH)
    cur = con.execute(query, args)
    con.commit()
    last_id = cur.lastrowid
    con.close()
    return last_id

def exec_write(query, args=()):
    con = sqlite3.connect(DB_PATH)
    cur = con.execute(query, args)
    con.commit()
    affected = cur.rowcount
    last_id = cur.lastrowid
    con.close()
    return affected, last_id

def devices_has_column(col):
    con = sqlite3.connect(DB_PATH)
    cur = con.execute("PRAGMA table_info(devices)")
    cols = [r[1] for r in cur.fetchall()]
    con.close()
    return col in cols

def ensure_room(conn, name):
    cur = conn.cursor()
    cur.execute("INSERT OR IGNORE INTO rooms(name) VALUES(?)", (name,))
    cur.execute("SELECT id FROM rooms WHERE name=?", (name,))
    row = cur.fetchone()
    return row[0] if row else None

def require_token():
    import os
    print(f"[AUTH DEBUG] Header={request.headers.get('X-API-Key')} Env={os.getenv('API_TOKEN')}", flush=True)
    token_env = os.getenv("API_TOKEN", "").strip()
    hdr = request.headers.get("Authorization", "")
    key = request.headers.get("X-API-Key", "")
    token = ""

    if hdr.startswith("Bearer "):
        token = hdr.split(" ", 1)[1].strip()
    elif key:
        token = key.strip()

    if token_env and token == token_env:
        return

    abort(401, description="Unauthorized")

@app.after_request
def add_cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-API-Key"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return resp

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
    sql = """
    SELECT
      d.device_id,
      COALESCE(d.room, r.name) AS room,
      (SELECT MAX(ts_utc) FROM heartbeats h WHERE h.device_id = d.device_id) AS last_hb
    FROM devices d
    LEFT JOIN rooms r ON d.room_id = r.id
    ORDER BY last_hb DESC;
    """
    data = row_query(sql)
    return jsonify([dict(r) for r in data])

@app.route("/api/devices/register", methods=["POST", "OPTIONS"])
def register_device():
    require_token()
    if request.method == "OPTIONS":
        return ("", 204)

    data = request.get_json(silent=True) or {}
    device_id = (data.get("device_id") or "").strip()
    room = (data.get("room") or "").strip()
    if not device_id or not room:
        abort(400, description="device_id and room are required")

    con = sqlite3.connect(DB_PATH)
    try:
        if devices_has_column("room"):
            con.execute("""
                INSERT INTO devices(device_id, room)
                VALUES(?, ?)
                ON CONFLICT(device_id) DO UPDATE SET room=excluded.room
            """, (device_id, room))
        elif devices_has_column("room_id"):
            room_id = ensure_room(con, room)
            con.execute("""
                INSERT INTO devices(device_id, room_id)
                VALUES(?, ?)
                ON CONFLICT(device_id) DO UPDATE SET room_id=excluded.room_id
            """, (device_id, room_id))
        else:
            abort(500, description="devices table has no room/room_id column")
        con.commit()
    finally:
        con.close()

    return jsonify({"ok": True, "device_id": device_id, "room": room})

@app.route("/api/devices/<device_id>/unregister", methods=["POST", "OPTIONS"])
def unregister_device(device_id):
    require_token()
    if request.method == "OPTIONS":
        return ("", 204)

    device_id = (device_id or "").strip()
    if not device_id:
        abort(400, description="device_id required")

    con = sqlite3.connect(DB_PATH)
    try:
        if devices_has_column("room"):
            con.execute("UPDATE devices SET room=NULL WHERE device_id=?", (device_id,))
        elif devices_has_column("room_id"):
            con.execute("UPDATE devices SET room_id=NULL WHERE device_id=?", (device_id,))
        else:
            abort(500, description="devices table has no room/room_id column")
        con.commit()
    finally:
        con.close()

    return jsonify({"ok": True, "device_id": device_id, "unregistered": True})

@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    require_token()
    status = request.args.get("status")             
    room_contains = request.args.get("room")        
    a_type = request.args.get("type")              
    since = request.args.get("since")               
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

@app.post("/api/alerts/close-bulk")
def close_bulk():
    require_token()
    status = request.args.get("status", "open")
    older_than_minutes = request.args.get("older_than_minutes", type=int) or 0
    a_type = request.args.get("type")
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

@app.route("/api/rooms", methods=["GET"])
def get_rooms():
    require_token()
    cfg = load_config()
    now = int(time.time())

    sql = """
    SELECT 
        r.name AS room,
        MAX(e.ts_utc) AS last_motion,
        COUNT(CASE WHEN e.ts_utc >= datetime('now', '-1 day') THEN 1 END) AS motions_today
      FROM rooms r
 LEFT JOIN devices d ON d.room = r.name
 LEFT JOIN motion_events e ON e.device_id = d.device_id
  GROUP BY r.name
  ORDER BY r.name;
    """

    rows = row_query(sql)
    res = []
    for r in rows:
        room_name = r["room"]
        if not room_name:
            continue

        last_motion_ts = 0
        try:
            if r["last_motion"]:
                dt = datetime.fromisoformat(r["last_motion"])
                last_motion_ts = int(dt.timestamp())
        except Exception:
            pass

        merged = get_room_cfg(room_name, cfg)
        inactivity = merged.get("inactivity_sec", 30 * 60)
        pre_offset = merged.get("prealert_offset_sec", 5 * 60)

        elapsed = now - last_motion_ts if last_motion_ts else 99999999
        prealert = (elapsed >= (inactivity - pre_offset)) and (elapsed < inactivity) and merged.get("enabled", True)
        alert_active = merged.get("enabled", True) and (elapsed >= inactivity)

        res.append({
            "room": room_name,
            "motions_today": r["motions_today"] or 0,
            "last_motion_ts": last_motion_ts,
            "elapsed_sec": elapsed,
            "prealert": prealert,
            "alert_active": alert_active,
            "config": merged
        })

    return jsonify(res)

@app.route("/api/rooms/<room>/settings", methods=["POST"])
def set_room_settings(room):
    require_token()
    body = request.get_json(force=True, silent=True) or {}
    cfg = load_config()
    cfg.setdefault("default", {
        "inactivity_sec": 30 * 60,
        "prealert_offset_sec": 5 * 60,
        "enabled": True
    })
    cfg[room] = cfg.get(room, {})
    for k in ("inactivity_sec", "prealert_offset_sec", "enabled", "night_block", "night_window"):
        if k in body:
            cfg[room][k] = body[k]
    save_config(cfg)
    log(f"[ROOM SETTINGS] Updated config for {room}: {cfg[room]}")
    return jsonify({"ok": True, "room": room, "config": get_room_cfg(room, cfg)})

@app.route("/api/rooms/<room>/led", methods=["POST"])
def led_control(room):
    require_token()
    body = request.get_json(force=True, silent=True) or {}
    action = body.get("action", "").lower()

    if action not in ("on", "off", "blink"):
        return jsonify({"ok": False, "error": "invalid action"}), 400

    import paho.mqtt.client as mqtt
    mqtt_client = mqtt.Client()
    mqtt_client.username_pw_set("iot", "iot")
    mqtt_client.connect("192.168.0.48", 1883, 60)

    topic = f"iot/eldercare/{room}/cmd/prealert"
    if action == "on":
        payload = {"action": "start", "reason": "MANUAL", "ttl_sec": 30}
    elif action == "off":
        payload = {"action": "stop", "reason": "MANUAL"}
    else:  # blink
        payload = {"action": "start", "reason": "MANUAL", "ttl_sec": 5}

    mqtt_client.publish(topic, json.dumps(payload), qos=0, retain=False)
    mqtt_client.disconnect()

    return jsonify({
        "ok": True,
        "room": room,
        "sent": payload
    })

# === Новый endpoint для получения текущих настроек комнаты ===
@app.route("/api/rooms/<room>/settings", methods=["GET"])
def get_room_settings(room):
    require_token()
    cfg = load_config()
    return jsonify({
        "ok": True,
        "room": room,
        "config": get_room_cfg(room, cfg)
    })

@app.route("/api/events/recent", methods=["GET"])
def api_recent_events():
    require_token()
    sql = """
      SELECT e.device_id, e.ts_utc, d.room
        FROM motion_events e
        LEFT JOIN devices d ON e.device_id = d.device_id
       ORDER BY e.ts_utc DESC
        LIMIT 20
    """
    rows = row_query(sql)
    result = {}
    for r in rows:
        room = r["room"] or "Unknown"
        if room not in result:
            result[room] = []
        result[room].append({
            "ts": r["ts_utc"],
            "text": f"Motion ({r['device_id']})"
        })
    return jsonify(result)

@app.before_request
def cors_preflight():
    if request.method == "OPTIONS":
        resp = make_response("", 204)
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-API-Key"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        return resp

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

