# FOH Desk — self hosted

FOH Desk creates message links that expire after 24 hours and keeps separate timesheets for FOH1, FOH2, and FOH3. A reader can acknowledge a message, leave it available until expiry, or destroy it immediately. The sender receives a private receipt link. Timesheets support clock in, clock out, and manual entries.

## Deploy with Coolify

1. Put this folder in a Git repository that Coolify can access.
2. In Coolify, create a new **Application** from that repository and select **Dockerfile** as the build pack. The Dockerfile is in the repository root and listens on port **3000**.
3. Add persistent storage: a **volume** mounted at `/data`. This keeps the SQLite database across redeploys.
4. Set the application domain to `https://foh.appsbydeepak.com` (or another subdomain routed to your Coolify server), then deploy.

If running without Coolify, `docker compose up -d --build` uses the same Dockerfile and creates a persistent named volume. Open `http://localhost:3000`.

The database is created automatically at `/data/foh.sqlite` inside the container. Back up the `/data` volume regularly. The earlier ChatGPT Sites edition has a separate database; this package starts with an empty one.

**Access:** Choosing FOH1, FOH2, or FOH3 requires no password, as requested. Anyone who can open the site can choose any name and view or change its entries. Treat the FOH Desk address as shared team access.

**Messages:** Message bodies are cleared when expired messages are accessed or when another database operation runs. Expiry is enforced on every read, so an expired message cannot be viewed even if automatic cleanup has not run yet. Receipt metadata remains for status display.
