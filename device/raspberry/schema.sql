PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT UNIQUE NOT NULL,
  room_id INTEGER REFERENCES rooms(id),
  room TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_utc TEXT NOT NULL,
  topic TEXT NOT NULL,
  device_id TEXT,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_raw_ts ON messages_raw(ts_utc);
CREATE INDEX IF NOT EXISTS idx_raw_topic ON messages_raw(topic);
CREATE INDEX IF NOT EXISTS idx_raw_dev_ts ON messages_raw(device_id, ts_utc);
CREATE INDEX IF NOT EXISTS idx_devices_room on devices(room);

CREATE TABLE IF NOT EXISTS heartbeats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_utc TEXT NOT NULL,
  device_id TEXT NOT NULL,
  ip TEXT,
  uptime_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_hb_dev_ts ON heartbeats(device_id, ts_utc);

CREATE TABLE IF NOT EXISTS motion_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_utc TEXT NOT NULL,
  device_id TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (0,1))
);
CREATE INDEX IF NOT EXISTS idx_motion_dev_ts ON motion_events(device_id, ts_utc);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_utc TEXT NOT NULL,
  room TEXT,
  device_id TEXT,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open'
);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_ts ON alerts(ts_utc);

CREATE TABLE IF NOT EXISTS daily_stats (
  day TEXT NOT NULL,
  device_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  value INTEGER NOT NULL,
  PRIMARY KEY (day, device_id, metric)
);

ALTER TABLE alerts ADD COLUMN created_at TEXT;
ALTER TABLE alerts ADD COLUMN closed_at TEXT;
ALTER TABLE alerts ADD COLUMN ack_at TEXT;
ALTER TABLE alerts ADD COLUMN ack_by TEXT;
ALTER TABLE alerts ADD COLUMN notified_at TEXT;
ALTER TABLE alerts ADD COLUMN channels TEXT;
ALTER TABLE alerts ADD COLUMN rule TEXT;
ALTER TABLE alerts ADD COLUMN params TEXT;

UPDATE alerts SET created_at = datetime('now') WHERE created_at IS NULL;

CREATE TABLE IF NOT EXISTS rule_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT
);

INSERT OR IGNORE INTO rule_settings (key, value) VALUES
('inactive.threshold_day_min', '45'),
('inactive.threshold_night_min', '180'),
('night.window', '23:00-06:00'),
('pattern.window_days', '14'),
('pattern.z_threshold', '2.5'),
('dwell.critical_rooms', 'Bathroom,Kitchen'),
('dwell.bathroom_min', '20'),
('dwell.kitchen_min', '45'),
('dwell.gap_min', '5');

CREATE TABLE IF NOT EXISTS notifications_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER,
    channel TEXT,
    sent_at TEXT DEFAULT (datetime('now')),
    ok INTEGER,
    details TEXT,
    FOREIGN KEY(alert_id) REFERENCES alerts(id)
);
