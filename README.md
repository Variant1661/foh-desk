# FOH Desk — self hosted

FOH Desk creates message links that expire after 24 hours and keeps separate timesheets for FOH1, FOH2, and FOH3. A reader can acknowledge a message, leave it available until expiry, or destroy it immediately. The sender receives a private receipt link. Timesheets support clock in, clock out, and manual entries.

## Deploy with Coolify

1. Put this folder in a Git repository that Coolify can access.
2. In Coolify, create a new **Application** from that repository and select **Dockerfile** as the build pack. The Dockerfile is in the repository root and listens on port **3000**.
3. Add persistent storage: a **volume** mounted at `/data`. This keeps the SQLite database across redeploys.
4. Set four **runtime environment variables** in Coolify: `FOH1_CODE`, `FOH2_CODE`, `FOH3_CODE`, and `FOH_ADMIN_CODE`. Give each a four-digit value. Keep them out of Git and do not mark them as build variables.
5. Set the application domain to `https://foh.appsbydeepak.com` (or another subdomain routed to your Coolify server), then deploy.

If running without Coolify, `docker compose up -d --build` uses the same Dockerfile and creates a persistent named volume. Open `http://localhost:3000`.

The database is created automatically at `/data/foh.sqlite` inside the container. Back up the `/data` volume regularly. The earlier ChatGPT Sites edition has a separate database; this package starts with an empty one.

**Access:** Each FOH name signs in with its own four-digit code. FOH users can view, add, edit, and delete only their own entries. Admin can see all entries and add, edit, or delete entries for any FOH name. The server checks permissions on every timesheet request. Sessions last 12 hours and can be ended with Sign out. Ten incorrect attempts for one account within 15 minutes temporarily block that account. Recipients can still open their message links without signing in.

**Messages:** Message bodies are cleared when expired messages are accessed or when another database operation runs. Expiry is enforced on every read, so an expired message cannot be viewed even if automatic cleanup has not run yet. Receipt metadata remains for status display.
