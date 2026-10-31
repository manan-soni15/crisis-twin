# Crisis Twin — Generative Portfolio Stress-Testing & Contagion Platform

> **Crisis Twin** turns macroeconomic shock scenarios described in plain English into quantitative portfolio stress tests, multi-hop contagion graphs, and adversarial multi-agent committee debates — tailored for Indian equities (Dalal Street) and global macro regimes.

---

## Key Features & Improvements

### 1. Interactive Crisis Twin Simulator (`/simulator`)
- **Natural Language Crisis Ingestion**: Describe complex macro shocks in plain words (e.g., *"What if oil jumps 25% and the central bank raises rates by 100 bps?"*). Groq-powered scenario parsers extract quantitative factor shocks automatically with resilient heuristic fallbacks.
- **Interactive Fine-Tuning Engine**:
  - Sliders for Crude Oil, Policy Rate (RBI repo rate), INR/USD Foreign Exchange, and Market Volatility (India VIX).
  - Dynamic state tracking distinguishing between **AI Baseline** and **User Customized** parameter overrides.
  - Seamless re-sync capability back to the initial AI extraction.
- **Audit-Linked Simulation Commits**: "Run & Commit Simulation" logs scenario runs into the persistent audit trail with unique Run IDs and instant visual commitment toasts.
- **Range-Based Uncertainty & Confidence**:
  - Displays expected portfolio moves alongside 5th-to-95th percentile ranges.
  - Empirical confidence scoring alerting users when scenarios exceed historical calibration bounds.
- **Holding-Level Attribution**: Granular before-and-after breakdown across individual portfolio assets (InterGlobe Aviation, Tata Motors, HDFC Bank, Infosys, ITC, Sun Pharma, Reliance Industries).

### 2. Multi-Hop Propagation Map (`/propagation`)
- **Visual Contagion Modeling**: Follows macro shocks as they transmit through first-order sector channels into individual equity holdings.
- **High-Contrast SVG Shock Graph**:
  - Custom SVG visualization with wide canvas spacing preventing node and text overlap.
  - Dedicated white pill badge capsules rendering sharp percentage loss/gain figures directly inside holding and sector capsules.
  - Interactive path isolation: hover or focus any node to highlight upstream causes and downstream impacts.
- **Hidden Exposure Detection**: Uncovers second-order cross-asset links that standard linear models miss (e.g., auto loan credit tightening linking Banks to Autos, or banking IT capex compression impacting IT Services).
- **Sector Vulnerability Matrix**: Real-time tracking of sector sensitivity and risk severity across Airlines, Banking, Autos, IT, Pharma, and FMCG.

### 3. 4-Agent Adversarial Debate Room (`/debate`)
- **Multi-Agent Consensus Committee**:
  - **Bull Agent**: Identifies tactical dip-buying opportunities, resilient balance sheets, and structural domestic SIP liquidity cushions.
  - **Bear Agent**: Attacks vulnerabilities, cyclical downside, current account deficit (CAD) expansion, and margin compression.
  - **Risk Auditor**: Enforces quantitative discipline, correlation stress checks, and concentration risk audits.
  - **Portfolio Manager**: Synthesizes conflicting arguments into prioritized tactical actions (hedges, trims, defensive rotation).
- **Dalal Street Macro Grounding**: Real-world context on RBI monetary policy, Gross Refining Margins (GRM), and domestic institutional capital flows.
- **Multi-Tier Groq LLM Cascade**:
  - Primary: `openai/gpt-oss-120b` (or configured Groq model).
  - Fast Secondary Fallback: `llama-3.3-70b-versatile`.
  - Teritiary Fallback: `llama3-70b-8192`.
  - Deterministic quant expert fallback ensuring zero downtime even under API rate limits.
- **Interactive Audio & Equalizer**: Live audio debate player with animated active speaker equalizer and FinBERT sentiment tracking.

### 4. Executive Report Card & Audit Trail (`/report`, `/audit`)
- **Executive Report Card**: Board-level crisis briefings summarizing scenario mechanics, capital at risk, percentile loss distributions, and committee recommendations.
- **Verifiable Audit Trail**: Tamper-evident logging of all committed stress tests, input parameters, and simulated outcomes.

---

## Tech Stack & Architecture

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Route Handlers)
- **Styling**: Tailwind CSS, custom design tokens, responsive typography
- **Data Visualizations**: Custom SVG shock graph, diverging impact bars, percentile range charts
- **AI & LLM Orchestration**: Groq SDK (`groq-sdk`) with multi-model cascade fallbacks
- **NLP & Sentiment**: FinBERT financial sentiment scoring heuristics
- **Persistence**: File-backed local state store (`data/crisis-twin.json`)

---

## Getting Started

### Prerequisites

- **Node.js**: `20.9+` (Node.js 22 LTS recommended)
- **npm** or **pnpm**
- **Groq API Key**: (Optional, for live LLM scenario extraction & debate agents)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/manan-soni15/crisis-twin.git
   cd crisis-twin
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   GROQ_MODEL=openai/gpt-oss-120b
   ```
   *(If no API key is provided, the platform automatically utilizes deterministic domain-calibrated fallbacks).*

4. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Production Build**:
   ```bash
   npm run build
   npm start
   ```

---

## Project Structure

```
├── app/
│   ├── (console)/              # Route pages
│   │   ├── simulator/          # Crisis Twin Simulator page
│   │   ├── propagation/        # Contagion map page
│   │   ├── debate/             # Adversarial debate room page
│   │   ├── report/             # Executive report card page
│   │   ├── audit/              # Audit trail log page
│   │   └── holdings/           # Portfolio holdings page
│   └── api/                    # Server-side Route Handlers
│       └── [...path]/          # Unified API dispatcher
├── components/
│   ├── SimulatorExperience.js  # Simulator controller & shock tuning UI
│   ├── PropagationExperience.js# Contagion map controller & matrix
│   ├── DebateExperience.js     # 4-agent debate UI & voice war room
│   ├── ReportExperience.js     # Executive report generator
│   ├── AuditExperience.js      # Audit trail viewer
│   └── viz/
│       ├── ShockGraph.js       # Custom SVG propagation & contagion graph
│       └── Charts.js           # Diverging and range bar charts
├── lib/
│   ├── server/
│   │   ├── quant-engine.js     # Multi-factor pricing & stress engine
│   │   ├── propagation-engine.js # Contagion graph & vulnerability calculations
│   │   ├── debate-orchestrator.js# Multi-agent debate prompt orchestration & cascade
│   │   ├── scenario-parser.js  # Natural language scenario parsing
│   │   └── finbert.js          # Financial sentiment analysis
│   └── sample.js               # Seeded portfolio & macro shock defaults
└── data/
    └── crisis-twin.json        # Persistent JSON database
```

---

## Disclaimer

Crisis Twin is a scenario simulation and stress-testing demonstration platform built for educational and research purposes. Scenarios reflect factor sensitivity models and synthetic multi-agent deliberation rather than certified financial advice or predictive forecasts.
