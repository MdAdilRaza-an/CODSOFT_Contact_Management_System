# Contact Management System API

## Setup

1. Install the declared dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `PORT`, `DB_HOST`, `DB_USER`,
   `DB_PASSWORD`, and `DB_NAME` for the database the API should use. Never
   commit `.env`.
3. Create a new, empty MySQL database for this application. Review
   `database/schema.sql`, select that new database, and apply the file manually.
   This file is the proposed initial schema source; the application does not
   create or migrate database objects.

**Do not apply `database/schema.sql` to an existing personal or production
database without reviewing the SQL and confirming the target database first.**
The schema uses unique constraints on email and phone; confirm these match your
data and requirements before applying it.

Start the API with `npm start` (or `npm run dev` for development). The server
checks MySQL connectivity before listening.

## API

- `GET /api/health` — process liveness response.
- `POST /api/contacts` — create a contact; send JSON fields `name`, `email`,
  `phone`, and optional `address` and `company`.
- `GET /api/contacts` — list contacts; supports `search`, `page`, `limit`,
  `sortBy`, and `order`.
- `GET /api/contacts/:id` — retrieve a contact.
- `PATCH /api/contacts/:id` — update supplied contact fields.
- `DELETE /api/contacts/:id` — delete a contact.

Contact routes currently do not implement authentication or authorization.
Do not expose the API publicly until an appropriate access-control requirement
and deployment protection have been established.

## Testing

Run `npm test` for the mocked HTTP and service regression tests. These tests do
not connect to MySQL or modify database records.

The optional live MySQL integration test is run separately with
`node --test tests/contact-api.integration.js`. It requires `.env` to name
`contact_management_db` as the configured personal database and requires a
separate, pre-created, empty `contact_management_test_db` with the reviewed
`database/schema.sql` applied. The test verifies its selected database before
using it, creates uniquely named test contacts, and removes only those
test-run contacts afterward. It does not create, drop, or migrate databases.
Do not run it if the test database is not disposable and empty.