# Crisis Twin (frontend)

Next.js (App Router, JavaScript) front end for Crisis Twin, a multi-agent portfolio stress simulator.
Every screen currently renders sample data from `lib/sample.js`. Replace those imports with your API calls.

## Run

```
npm install
npm run dev
```

## Routes

| Route | Feature |
|---|---|
| `/` | Landing page (`app/page.js`) |
| `/dashboard`, `/holdings` | Portfolio overview, holdings and paper-trade ticket |
| `/simulator` | Crisis Twin simulator |
| `/propagation` | Shock propagation map |
| `/debate` | Bull, Bear and Risk Auditor debate |
| `/war-room` | Voice war room (`components/VoiceOrb.js` is where speech-to-text hooks in) |
| `/drill` | Crisis drill |
| `/replay`, `/report`, `/audit` | Regret replay, report card, audit trail |
| `/why`, `/profile` | Why it moved, risk profile |

## Structure

- `app/(console)/` holds all feature pages and shares one layout (side rail, top bar, mobile drawer).
- `lib/nav.js` is the single source for navigation. Add a page there and it appears in the rail, landing list and next-step links.
- `components/viz/` has the dependency-free SVG charts and the shock graph.
- Theme tokens (colors, fonts) live in `app/globals.css` under `@theme`.
