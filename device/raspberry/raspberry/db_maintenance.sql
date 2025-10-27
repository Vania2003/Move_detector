DELETE FROM messages_raw WHERE ts_utc < datetime('now','-60 day');
VACUUM;
DELETE FROM notifications_log WHERE sent_at < datetime('now','-30 days');
DELETE FROM alerts WHERE status='closed' AND closed_at < datetime('now','-90 days');
VACUUM;
