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
  linked_from TEXT,
  forwarded_to TEXT,
  counter INTEGER CHECK(counter BETWEEN 1 AND 3),
  priority TEXT CHECK(priority IN ('senior','pregnant','emergency')),
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  away_until INTEGER,
  estimate_min INTEGER,
  UNIQUE(queue_date, number),
  UNIQUE(queue_date, code, seq)
);

-- US-11: service counters open per queue per day, e.g. "1,2". A queue with no row has Counter 1 open.
CREATE TABLE IF NOT EXISTS open_counters (
  queue_date TEXT NOT NULL,
  code TEXT NOT NULL REFERENCES departments(code),
  counters TEXT NOT NULL,
  PRIMARY KEY (queue_date, code)
);

-- US-21: a doctor delay notice per queue per day; it ends at until_ms (or when staff clear it).
CREATE TABLE IF NOT EXISTS delays (
  queue_date TEXT NOT NULL,
  code TEXT NOT NULL REFERENCES departments(code),
  reason TEXT NOT NULL CHECK(reason IN ('surgery','break','emergency','other')),
  until_ms INTEGER NOT NULL,
  PRIMARY KEY (queue_date, code)
);

CREATE INDEX IF NOT EXISTS idx_tokens_daily_queue
ON tokens(queue_date, code, status, seq);

CREATE INDEX IF NOT EXISTS idx_tokens_daily_status
ON tokens(queue_date, status, seq);
