# Magenta inventory backend

## Host the inventory backend on Supabase

The website can use Supabase Postgres for products, Supabase Storage for product photos, and the `inventory` Edge Function for the existing catalogue and admin API. The migration creates the schema and loads the current sample catalogue. The public website uses only the project URL; the admin token and service-role key stay on Supabase and must never be added to website files.

1. Create a Supabase project and install or run the Supabase CLI.
2. From the project root, authenticate and link the project:

   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Apply the database migration and deploy the function:

   ```powershell
   npx supabase db push --remote
   npx supabase functions deploy inventory
   ```

4. Set a private admin token of at least 32 characters and the exact website origin. For a GitHub Pages project site, the origin is `https://username.github.io` (not the repository path):

   ```powershell
   npx supabase secrets set ADMIN_TOKEN="replace-with-a-private-random-token-of-at-least-32-characters" ALLOWED_ORIGIN="https://username.github.io"
   ```

   The Supabase Edge Function runtime provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Do not copy the service-role key into the website.

5. In `js/api-config.js`, set `window.MAGENTA_SUPABASE_URL` to the project URL, such as `https://your-project-ref.supabase.co`. Publish that change with the static website. The project URL is not a secret. The admin page's API URL override is only needed for a local or alternate API and is saved in that browser.
6. Open `/admin.html` on the published site and unlock stock management with the `ADMIN_TOKEN` value you set in Supabase. Use the same token only on this private page.

The database migration seeds the sample products from `backend/data/products.json`, without photos. After deployment, upload product photos from the admin page; they are stored in the public `product-images` bucket. Public product reads and photo reads are intentionally enabled. Product writes are handled only by the Edge Function and require the admin token. Direct table access is blocked by row-level security.

To load different initial products, update the insert rows in `supabase/migrations/20261110090000_inventory.sql` before applying the migration. Database migrations that have already been applied should not be edited; create a new migration for later data changes.

## Run the Node.js backend locally

The Node.js server exposes the public inventory API and accepts protected product postings, edits, availability changes, and photo uploads. The static website and its separate stock-management page (`admin.html`) can be hosted on GitHub Pages; the Node.js API must run on a separate Node-capable host. Inventory is saved in `backend/data/products.json`; uploaded JPEG, PNG, and WebP files are saved in `backend/uploads/`.

## Run locally

1. Install Node.js 18 or newer.
2. From the project root, run `npm install`.
3. Configure a private admin token of at least 32 characters and start the server:

   ```powershell
   $env:ADMIN_TOKEN = "replace-with-a-private-random-token-of-at-least-32-characters"
   npm start
   ```

4. On Windows, run `npm run start:local`. The script generates a temporary admin token and prints it in the terminal. Keep the terminal open while using the site. On macOS/Linux, set a private `ADMIN_TOKEN` of at least 32 characters and run `npm start`.
5. Open `http://127.0.0.1:3000/admin.html`, leave the API base URL empty, and unlock stock management with the token printed by the local startup script. Open the store at `http://127.0.0.1:3000/store.html`.

The token is never saved in browser storage. The browser sends it only as a bearer token when using the protected admin actions. The store can be browsed without it.

Do not open `admin.html` or `store.html` directly as a `file://` URL. The backend serves the frontend pages and `/api/products` on the same origin, so use the `http://127.0.0.1:3000` addresses above for local use.

The server binds to `127.0.0.1` by default. For deployment, configure `HOST=0.0.0.0`, keep `ADMIN_TOKEN` secret, set `ALLOWED_ORIGIN` to the exact GitHub Pages origin (for example `https://username.github.io`—no repository path or trailing slash), and put the API behind HTTPS. Configure persistent storage for `backend/data` and `backend/uploads`; ephemeral hosting filesystems will lose inventory and photos on restart.

## Host the Node.js backend separately

1. Enable GitHub Pages for the repository and publish the site from its root.
2. Deploy the `backend/` Node.js service to a separate host that supports Node.js and persistent storage.
3. Configure `ADMIN_TOKEN`, `HOST=0.0.0.0`, and `ALLOWED_ORIGIN` in the API host's private environment settings.
4. Edit `js/api-config.js` and set `window.MAGENTA_API_BASE_URL` to the API's HTTPS origin, then publish that change. This shared setting lets every visitor's store page load stock and product photos.
5. Open `/admin.html` on the GitHub Pages site. The API URL field can set a browser-local override for admin use; this override is not shared with store visitors. Enter the admin token only on this page.

GitHub Pages is static hosting: it cannot run `backend/server.js`, protect write requests, or persist uploaded photos. Do not put the admin token in `js/api-config.js` or any other published file. GitHub Pages project sites share one origin (for example `https://username.github.io`) even when the repository URL includes a path.

## API

Product postings may include an optional `brand` field; the store uses it for brand filtering and can infer common brands from existing product names.

- `GET /api/products` returns the public product catalogue.
- `POST /api/products` accepts multipart form fields `name`, `brand`, `specs`, optional `description`, `price`, `category`, `badge`, `inStock` (`true` or `false`), and required `image`; requires `Authorization: Bearer <ADMIN_TOKEN>`. New products can be published as out of stock.
- `PATCH /api/products/:id` updates product details and `inStock`; accepts an optional replacement `image` and requires the same authorization.
- `PATCH /api/products/:id/photo` replaces a product photo using multipart field `image`; requires the same authorization.
- `DELETE /api/products/:id` removes a product and its uploaded image; requires the same authorization.

The store displays out-of-stock products but disables adding them to the cart. The admin page supports posting, editing product details and availability, replacing photos, and removing products. Product details can contain up to 1,000 characters; specifications are limited to 500 characters. The server validates product fields and category, requires a product photo when creating a product, and allows JPEG, PNG, and WebP uploads up to 5 MB. The admin category choices match the store filters: Laptops, All-in-ones, Ex UK Deals, Brand New Laptops, POS Systems, Accessories, Printers & Scanners, Networking, Gaming, Apple Products, and Service & Repair. Configure HTTPS and a strong, private `ADMIN_TOKEN` before exposing the server to the internet. Use persistent storage for `backend/data` and `backend/uploads` when deploying; ephemeral hosting filesystems will lose inventory and photos on restart.
