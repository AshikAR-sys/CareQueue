CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  doctors_json TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS queue_counters (
  queue_date TEXT NOT NULL,
  code TEXT NOT NULL REFERENCES departments(code),
  last_seq INTEGER NOT NULL CHECK(last_seq BETWEEN 1 AND 999),
  PRIMARY KEY (queue_date, code)
);

CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  queue_date TEXT NOT NULL,
  number TEXT NOT NULL,
  code TEXT NOT NULL REFERENCES departments(code),
  seq INTEGER NOT NULL CHECK(seq BETWEEN 1 AND 999),
  status TEXT NOT NULL CHECK(status IN ('waiting','serving','done','missed')),
  patient_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK(age BETWEEN 0 AND 120),
  gender TEXT NOT NULL,
  phone TEXT NOT NULL,
  doctor TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  called_at INTEGER,
  done_at INTEGER,
  skipped_at INTEGER,
  UNIQUE(queue_date, number),
  UNIQUE(queue_date, code, seq)
);

CREATE INDEX IF NOT EXISTS idx_tokens_daily_queue
ON tokens(queue_date, code, status, seq);

CREATE INDEX IF NOT EXISTS idx_tokens_daily_status
ON tokens(queue_date, status, seq);
