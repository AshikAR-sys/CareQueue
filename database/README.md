# CareQueue Database

CareQueue uses SQLite for persistent queue data.

- `schema.sql`: departments, daily queue counters, tokens, constraints, and indexes.
- `seed.sql`: sample departments and doctors used by the prototype.
- `carequeue.sqlite3`: created automatically at runtime and intentionally ignored by Git.

The backend initializes the schema and seeds sample departments when it starts. Queue counters and token changes are persisted in the database, so separate browser tabs connect to the same server state.

Do not commit a populated database file. This is a hackathon prototype; review retention, access control, and patient-data privacy before any real hospital use.
