# Backend status

**Status: not implemented in the current CareQueue prototype.**

The current app runs entirely in the browser. Queue operations live in `frontend/js/queue.js` and are stored in browser `localStorage`; there is no HTTP API, server-side authentication, or backend runtime in this repository yet.

When implementing the backend, add the server entry point, route handlers, validation, and services here. The frontend should be migrated to call the API only as a separate, tested change that preserves the existing demo flows.

Do not treat this directory as a working backend until those components are implemented and tested.
