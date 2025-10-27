DELETE FROM messages_raw WHERE ts_utc < datetime('now','-60 day');
VACUUM;
DELETE FROM notifications_log WHERE sent_at < datetime('now','-30 days');
DELETE FROM alerts WHERE status='closed' AND closed_at < datetime('now','-90 days');
VACUUM;
CREATE INDEX IF NOT EXISTS idx_alerts_status_id     ON alerts(status,id);
CREATE INDEX IF NOT EXISTS idx_alerts_room          ON alerts(room);
CREATE INDEX IF NOT EXISTS idx_alerts_type          ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_ts_utc        ON alerts(ts_utc);
CREATE INDEX IF NOT EXISTS idx_hb_dev_ts            ON heartbeats(device_id, ts_utc);
CREATE INDEX IF NOT EXISTS idx_motion_dev_ts        ON motion_events(device_id, ts_utc);

