# mintara — API Response Comparison Tool

A lightweight web-based tool for validating API response parity during migrations. Send identical requests to multiple API endpoints simultaneously, compare responses deeply, and export results for reporting.

**Primary use case:** PHP 5 → PHP 8 migration validation

![mintara](https://img.shields.io/badge/version-1.0.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)
![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-5.3-646cff)

## Features

- 🚀 **Parallel API Requests** — Send requests to 2+ targets simultaneously
- 📊 **Deep JSON Comparison** — Recursive diff with dot-notation path tracking
- 🎨 **Visual Diff UI** — Side-by-side comparison with color-coded changes
- ⚙️ **Normalization Engine** — Ignore fields, sort arrays, float tolerance
- 📤 **Export Formats** — JSON, Excel (colored cells), PNG screenshots
- 💾 **Test Case Management** — Save, load, and reuse test configurations
- 🔌 **No CORS Issues** — Built-in proxy server for API calls
- 🪝 **Mock Webhook** — Local webhook.site replacement: configurable mock endpoints plus a live request log

## Install

```bash
npm install -g @gerinaryo/mintara
mintara
```

That starts a single server serving both the app and its API on one port (`http://localhost:3001` by default, override with `PORT=...`).

## Run from source

```bash
# Clone and navigate to the project
cd mintara

# Install dependencies
npm install

# Start both client and server
npm start
```

In this mode the client (with hot reload) and the API run on separate ports:
- **Frontend:** http://localhost:5174
- **Backend API:** http://localhost:3001

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Available variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Express server port |
| `REQUEST_TIMEOUT_MS` | `10000` | Outbound request timeout (ms) |
| `MINTARA_DATA_DIR` | `~/.mintara` | Where mock definitions (`mocks.json`) are stored |

## Usage

### Basic Comparison

1. Enter target API URLs (minimum 2 required)
2. Configure HTTP method, headers, and body
3. Click **Compare**
4. View results with color-coded diff highlighting

### Normalization Options

- **Ignore Fields:** Enter dot-notation paths to exclude (e.g., `user.updatedAt`, `meta.timestamp`)
- **Sort Arrays:** Enable to compare arrays regardless of element order

### Test Cases

- **Save:** Click "Save Test Case" and enter a name
- **Load:** Click "Load Test Case" to restore a saved configuration
- **Delete:** Remove unwanted test cases from the load dialog
- Test cases persist in browser localStorage

### Exports

| Format | Description |
|--------|-------------|
| **JSON** | Full `CompareResult` with all responses and diffs |
| **Excel** | Flattened diff table with colored cells (yellow=changed, green=added, red=removed) |
| **PNG** | Screenshot of the diff panel for sharing |

### Mock Webhook

A local stand-in for webhook.site, for when the code under test calls a third-party API (payments, notifications, billing, …). The **server** serves the mocks on its own port, so Docker containers and other machines on your network can reach them.

1. Open **Mock Webhook** in the left menu.
2. Type a slug (lowercase letters, digits, `-`, `_`) and press **+**, or **Import** a mock file (see below).
3. Paste the endpoint URL into the caller's config (an env var, config file, or setting). From a Docker container, use the `host.docker.internal` form:

   ```
   EXTERNAL_API_URL=http://host.docker.internal:3001/hook/my-api
   ```

   From the host itself, use `http://localhost:3001/hook/my-api`.
4. Edit the rules, then click **Save**. Each rule has a method (or `ANY`), a sub-path, a status, headers, a body and an optional delay.
   - The sub-path is the part after `/hook/<slug>`. It's either exact (`/charge`) or a glob, where `*` matches anything, `/` included (`/orders/*`).
   - Rules are checked top to bottom and the first match wins. Anything unmatched gets the slug's default response.
   - A slug that doesn't exist gets `404 {"error":"unknown mock slug"}`, and the call is still logged.
5. Calls show up live in the request log. Each entry shows the headers, the query, the body (pretty-printed when it's JSON) and the exact response that was sent, and has a **Copy as cURL** button.

**Body placeholders**, filled from the incoming request:

| Placeholder | Fills in |
|-------------|----------|
| `{{body.items.0}}` | a value from the JSON body (dot path, array indexes allowed) |
| `{{query.userId}}` | a query-string parameter |
| `{{headers.x-request-id}}` | a request header (case-insensitive) |
| `{{uuid}}` / `{{now}}` / `{{timestamp}}` | a random UUID / ISO time / epoch ms |

Strings are inserted as-is, with no JSON escaping. Other values are JSON-encoded. A path that doesn't resolve becomes an empty string.

**Import / Export** works the same way as for test cases.
- **Export:** select one or more mocks, then click **Export (n)**. One mock downloads as a `.json` file; several download as a `.zip` with one `.json` per mock.
- **Import:** accepts a `.json` or `.zip` file. If a slug already exists, you choose **Overwrite** or **Skip** for it. A file can be a mintara export, a bare array of mocks, or a single mock object, so hand-written files work too. For example:

```json
{
  "kind": "mintara-mocks",
  "version": 1,
  "mocks": [
    {
      "slug": "my-api",
      "rules": [
        {
          "method": "POST",
          "path": "/charge",
          "response": {
            "status": 200,
            "headers": { "Content-Type": "application/json" },
            "body": "{\"status\":\"success\",\"message\":\"Charged\"}"
          }
        }
      ],
      "defaultResponse": { "status": 200, "headers": { "Content-Type": "application/json" }, "body": "{\"status\":\"success\"}" }
    }
  ]
}
```

A rule's `id` is optional; one is generated when it's missing.

**Storage and privacy:**
- Mock definitions are saved to `~/.mintara/mocks.json` (or `$MINTARA_DATA_DIR/mocks.json`).
- The request log is kept **in memory only**: up to 500 calls per slug, cleared on restart, and never written to disk or printed to the console. **Clear** empties one slug's log; **Clear all mocks** empties every log.

## Architecture

Three independent product domains — API Diff Checker, File Diff Checker and Mock Webhook — each with their own folder on the client and server, plus a shared pure-logic package:

```
mintara/
├── shared/          # Pure TypeScript logic (no runtime deps)
│   ├── types.ts     # Shared interfaces
│   ├── normalize.ts # Field ignoring, array sorting
│   └── compare.ts   # Deep diff engine
├── server/          # Express API — the package published to npm
│   └── src/domains/
│       ├── api-diff/    # POST /api/compare, POST /api/summarize
│       ├── file-diff/   # POST /api/files/find
│       └── mock-webhook/ # /hook/:slug/* receiver, /api/mocks management
└── client/          # Vite + React SPA
    └── src/domains/
        ├── api-diff/    # Request builder, diff viewer, test cases
        ├── file-diff/   # Text diff checker, file finder
        └── mock-webhook/ # Mock editor, live request log
```

See [CONTEXT.md](CONTEXT.md) for the domain vocabulary.

### Tech Stack

- **Frontend:** Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui, Zustand
- **Backend:** Express, tsx, axios
- **Shared:** TypeScript (no runtime dependencies)
- **Diff Viewer:** `react-diff-viewer-continued`
- **JSON Editor:** `@monaco-editor/react`
- **Exports:** `exceljs`, `html2canvas`

## API Endpoints

### `GET /api/health`

Health check endpoint.

**Response:**
```json
{ "ok": true }
```

### `POST /api/compare`

Execute parallel API requests and compare responses.

**Request:**
```json
{
  "method": "GET",
  "path": "/users/123",
  "body": { "user_id": 123 },
  "targets": [
    { "name": "PHP 5", "baseUrl": "https://old-api.com", "headers": { "Authorization": "Bearer token" } },
    { "name": "PHP 8", "baseUrl": "https://new-api.com", "headers": { "Authorization": "Bearer token" } }
  ],
  "normalization": {
    "ignoreFields": ["updated_at", "request_id"],
    "sortArrays": true
  }
}
```

**Response:**
```json
{
  "targets": [
    {
      "name": "PHP 5",
      "url": "https://old-api.com/users/123",
      "status": 200,
      "responseTimeMs": 145,
      "body": { ... }
    },
    {
      "name": "PHP 8",
      "url": "https://new-api.com/users/123",
      "status": 200,
      "responseTimeMs": 132,
      "body": { ... }
    }
  ],
  "hasChanges": false
}
```

### Mock Webhook endpoints

| Method | Path | Purpose |
|--------|------|---------|
| any | `/hook/:slug` and `/hook/:slug/*` | The mock receiver itself |
| `GET` | `/api/mocks` | List mocks |
| `POST` | `/api/mocks` | Create `{ "slug": "x" }` |
| `POST` | `/api/mocks/import` | `{ "mocks": [...], "resolutions": { "<slug>": "overwrite" \| "skip" } }`; existing slugs are skipped unless marked `overwrite` |
| `GET` / `PUT` / `DELETE` | `/api/mocks/:slug` | Read / replace `rules` + `defaultResponse` / delete |
| `POST` | `/api/mocks/:slug/rename` | `{ "newSlug": "y" }`; the request log moves with it |
| `GET` | `/api/mocks/:slug/requests?limit=` | Request log, newest first |
| `DELETE` | `/api/mocks/:slug/requests` | Clear one log |
| `DELETE` | `/api/mocks/requests` | Clear every log |
| `GET` | `/api/mocks/:slug/stream` | Server-Sent Events: `request` and `cleared` events |
| `GET` | `/api/mocks/info` | `{ port }` |

## Development

### Project Setup

```bash
# Install dependencies
npm install

# Start development servers
npm start
```

### Build the CLI package

A `Makefile` wraps the commands used to build and publish the npm CLI package (`server/`, which bundles the built client alongside it):

```bash
make build    # build client + bundle server into server/dist, server/public
make pack     # build, then produce a local tarball (server/*.tgz) without publishing
make publish  # build, then npm publish (requires npm login; add OTP=123456 if 2FA prompts)
make clean    # remove build artifacts
```

### Workspace Scripts

```bash
# Run all tests
npm test

# Start specific workspace
npm run dev --workspace=server
npm run dev --workspace=client
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

## Acknowledgments

Built with:
- [Vite](https://vitejs.dev/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [react-diff-viewer-continued](https://github.com/cezaraugusto/react-diff-viewer-continued)
