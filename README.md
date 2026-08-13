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

## Architecture

Two independent product domains — API Diff Checker and File Diff Checker — each with their own folder on the client and server, plus a shared pure-logic package:

```
mintara/
├── shared/          # Pure TypeScript logic (no runtime deps)
│   ├── types.ts     # Shared interfaces
│   ├── normalize.ts # Field ignoring, array sorting
│   └── compare.ts   # Deep diff engine
├── server/          # Express API — the package published to npm
│   └── src/domains/
│       ├── api-diff/    # POST /api/compare, POST /api/summarize
│       └── file-diff/   # POST /api/files/find
└── client/          # Vite + React SPA
    └── src/domains/
        ├── api-diff/    # Request builder, diff viewer, test cases
        └── file-diff/   # Text diff checker, file finder
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
