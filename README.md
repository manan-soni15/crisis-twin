# Crisis Twin

Crisis Twin is a Next.js application with its API implemented using Next.js Route Handlers. The UI and server-side API run together; no FastAPI process or Python environment is required.

## Requirements

- Node.js 20.9+ (Node.js 22 LTS recommended)
- npm

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The API is served from the same origin under `/api`; API documentation at `/api/docs` is not provided because there is no OpenAPI/FastAPI server.

## Build for production

```bash
npm run build
npm start
```

## Data storage

Portfolio, paper-trade, risk-profile, drill, simulation and audit records are stored in `data/crisis-twin.json`. The file is created/updated by the Next.js server. Keep this file backed up if you want to preserve local state. This initial local prototype uses a shared default portfolio and is not an authenticated multi-user financial service.

## Market data and simulation caveats

The current portfolio contains seeded example prices. No live price provider is configured, and the API reports `seeded_fallback` rather than claiming prices are live. Scenario results use transparent sector-sensitivity heuristics with low confidence; they are not calibrated forecasts, VaR estimates, or investment advice. Do not use them to make real investment decisions.

## API endpoints

The Next.js catch-all route in `app/api/[...path]/route.js` handles portfolio, paper trading, scenario parsing/simulation, profile, drill results, reports, audit history, voice intent, debate, replay and attribution endpoints. The existing UI continues to call these through `lib/api.js` using same-origin `/api` requests.
