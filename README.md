# Crisis Twin

A multi-agent portfolio stress simulator and crisis war room.

---

## Architecture & Work Split

The system is composed of a **FastAPI** backend and a **Next.js (App Router)** frontend.

| Member | Role | Features Owned | Backend Scope |
|---|---|---|---|
| **Manan** | Voice and Agents Lead | Voice war room, Crisis drill, Debate room, Audit trail | `voice/`, `agents/`, `audit/`, LLM client |
| **Aditya** | Quant Engine Lead | Crisis Twin simulator, Propagation map, Regret replay, Why it moved | `quant/`, `graph/`, `backtest/` |
| **Manthan** | Data & Portfolio Lead | Overview, Holdings & paper trading, Report card, Risk profile, Database & deploy | `data/`, `portfolio/`, `report/`, `profile/`, `db/` |

---

## Getting Started

### 1. Backend Setup & Run (FastAPI)

#### Prerequisites
- Python 3.10+ (tested with Python 3.11 - 3.13)
- SQLite3 (built into Python)

#### Installation
```bash
# From workspace root
# 1. Create and activate a virtual environment (optional but recommended)
python -m venv venv
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS/Linux:
# source venv/bin/activate

# 2. Install backend dependencies
pip install -r backend/requirements.txt
```

#### Environment Configuration
Copy the sample environment file:
```bash
# Windows (PowerShell):
Copy-Item backend/.env.example backend/.env
# macOS/Linux:
# cp backend/.env.example backend/.env
```
Key backend variables:
- `HOST`: Bind host (default `0.0.0.0`)
- `PORT`: Server port (default `8000`)
- `DATABASE_PATH`: SQLite database path (default `crisis_twin.db` inside `backend/`)
- `CORS_ORIGINS`: Allowed origins for Next.js (`http://localhost:3000,http://127.0.0.1:3000`)
- `META_API_KEY`, `META_MODEL`, `META_BASE_URL`: Optional credentials for live LLM inference
- `FRED_API_KEY`: Optional fallback key for macro factor data

#### Run Backend Server
```bash
# From workspace root
python -m backend.run
# Or directly via uvicorn:
# uvicorn backend.app.main:app --reload --port 8000
```
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)
- Interactive API Docs (Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)
- Alternative Docs (ReDoc): [http://localhost:8000/redoc](http://localhost:8000/redoc)

#### Run Backend Tests
```bash
python -m backend.tests.test_endpoints
python -m backend.tests.test_persistence
```

---

### 2. Frontend Setup & Configuration (Next.js)

#### Prerequisites
- Node.js 18+ and npm

#### Environment Configuration
By default, the frontend points to `http://localhost:8000`. To customize the backend URL:
```bash
# Create .env.local in root
# NEXT_PUBLIC_API_URL=http://localhost:8000
```
See [.env.example](file:///.env.example).

The client helper [lib/api.js](file:///lib/api.js) automatically reads `NEXT_PUBLIC_API_URL`.
- For read endpoints (`/portfolio`, `/audit/runs`, `/profile`), if the backend is unreachable, the frontend gracefully falls back to mock sample data from [lib/sample.js](file:///lib/sample.js) so pages do not break.
- For mutation/action endpoints (`/paper/trade`, `/drill/result`), failed requests will **not** silently fall back to mock success—they properly return error details so users receive real rejection notifications.

#### Run Frontend
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Frontend Routes

| Route | Feature | Owner |
|---|---|---|
| `/` | Landing page (`app/page.js`) | All |
| `/dashboard` | Portfolio overview & survival score | Manthan |
| `/holdings` | Portfolio holdings & interactive paper trading ticket | Manthan |
| `/simulator` | Crisis Twin scenario stress simulator | Aditya |
| `/propagation` | Shock propagation cascade graph | Aditya |
| `/debate` | Bull, Bear, and Risk Auditor debate room | Manan |
| `/war-room` | Voice war room (`components/VoiceOrb.js`) | Manan |
| `/drill` | Timed crisis decision drill | Manan |
| `/replay` | Regret replay of historical market crashes | Aditya |
| `/report` | Shareable crisis report card | Manthan |
| `/audit` | Full audit trail and reasoning logs | Manan |
| `/why` | Return attribution & verdict | Aditya |
| `/profile` | Behavioral loss tolerance & risk profile | Manthan |

---

## API Endpoints & Contracts

### Portfolio & Trading (Manthan)
- `GET /portfolio` - Returns portfolio balance, holdings, weights, betas, day change.
- `POST /paper/trade` - Validates and executes paper trades. Requires `confirmed: true`.

### Simulation & Quant Engine (Aditya)
- `POST /scenario/parse` - Converts user natural language text into structured shocks object.
- `POST /simulate` - Runs factor Monte Carlo stress model, outputs VaR, CVaR, impact per holding.
- `POST /propagate` - Computes shock transmission graph, nodes, edges, hidden exposures.
- `GET /replay/{crisis}` - Replays real crashes (2008, 2020, 2022, oil).
- `GET /why?date=` - Daily return attribution waterfall, factor drivers, and story.

### Voice & Multi-Agent Debate (Manan)
- `POST /voice/intent` - Classifies voice transcript into contract intents (`RUN_SCENARIO`, `START_DEBATE`, `INTERRUPT_AGENT`, `REBALANCE`, `PAPER_TRADE`, `EXPLAIN_MOVE`, `BRIEFING`, `DRILL_DECISION`). Supports compound actions (`post_action`, `focus_agent`).
- `POST /debate` - Multi-agent debate output (Bull, Bear, Risk Auditor, Portfolio Manager) with claims, severity, confidence, and cited evidence fields.
- `POST /drill/result` - Records timed drill decisions and generates debrief sentences.
- `GET /audit/runs` & `GET /audit/runs/{id}` - Audit records of past runs and linked `agent_logs`.
