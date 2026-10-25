# CareQueue Backend

Flask REST API for issuing tokens and managing the daily queues. The UI is served by the same process so the pages and API share one origin.

## Run locally

From the repository root:

```bash
python -m pip install -r backend/requirements.txt
python backend/app.py
```

Open http://127.0.0.1:8000. The API health check is at `/api/health`.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/departments` | Departments and doctors |
| GET | `/api/queue/state` | Current daily queue for the staff/patient UI |
| GET | `/api/queue/public-state` | Public display state; excludes patient details |
| POST | `/api/tokens` | Validate details and issue the next token |
| POST | `/api/queue/{code}/call-next` | Finish the current token and call the next waiting token |
| POST | `/api/queue/{code}/skip` | Move the serving token to Missed |
| POST | `/api/tokens/{number}/recall` | Recall a missed token |

Queue counters and status changes are stored in SQLite through the service layer in `services/queue_service.py`. Server-side input validation is performed before issuing a token.

## Security limitation

The login/PIN UI is still a hackathon demo and is checked in browser JavaScript, not by secure server-side authentication. Do not expose this prototype publicly or use real patient information until authentication, authorization, HTTPS, rate limiting, and privacy controls are implemented and reviewed.
