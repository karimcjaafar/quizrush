CREATE TABLE IF NOT EXISTS answers (
  qkey TEXT PRIMARY KEY,
  right INTEGER NOT NULL DEFAULT 0,
  wrong INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS daily (
  date TEXT NOT NULL,
  device TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  score INTEGER NOT NULL,
  time REAL NOT NULL,
  won INTEGER NOT NULL,
  PRIMARY KEY (date, device)
);
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily (date, won, score);
-- Global per-mode leaderboard: one best row per device per mode.
CREATE TABLE IF NOT EXISTS scores (
  mode TEXT NOT NULL,
  device TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  score INTEGER NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (mode, device)
);
CREATE INDEX IF NOT EXISTS idx_scores_mode ON scores (mode, score);
