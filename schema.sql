CREATE TABLE IF NOT EXISTS notification_devices (
  device_id TEXT PRIMARY KEY,
  subscription TEXT NOT NULL,
  endpoint_hash TEXT NOT NULL UNIQUE,
  connected_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_test_at INTEGER NOT NULL DEFAULT 0,
  last_delivery_at INTEGER,
  delivery_status TEXT NOT NULL DEFAULT 'connected'
);
CREATE TABLE IF NOT EXISTS notification_schedules (
  device_id TEXT NOT NULL REFERENCES notification_devices(device_id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  name TEXT NOT NULL,
  time TEXT NOT NULL,
  created TEXT NOT NULL,
  next_at INTEGER NOT NULL,
  PRIMARY KEY(device_id, task_id)
);
CREATE INDEX IF NOT EXISTS notification_due ON notification_schedules(next_at);
CREATE TABLE IF NOT EXISTS notification_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notification_limits_expiry ON notification_limits(expires_at);
CREATE TABLE IF NOT EXISTS notification_runtime (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_tick_at INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO notification_runtime(id, last_tick_at) VALUES (1, 0);
