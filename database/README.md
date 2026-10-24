# Database status

**Status: not implemented in the current CareQueue prototype.**

The current queue is stored in each browser's `localStorage`, so it is not shared across devices and is not a server database. This repository currently has no database engine configuration, schema, migrations, or seed data.

When a persistent database is added, keep schema definitions, migrations, and seed data here, and connect it through the backend. Do not store patient data or secrets in this directory as plain committed files.

Do not treat this directory as a working database until the database layer is implemented and tested.
