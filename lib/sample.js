// Placeholder data so every screen has something real-looking to render.
// Replace these imports with your API calls when you wire up the features.

export const SHOCKS = [
  { id: "oil", label: "Oil +25%", name: "Oil price spike" },
  { id: "rates", label: "Rates +100 bps", name: "Interest-rate hike" },
  { id: "conflict", label: "Conflict", name: "Geopolitical conflict" },
  { id: "scandal", label: "Scandal", name: "Major company scandal" },
];

export const SECTORS = [
  { id: "energy", label: "Energy" },
  { id: "airlines", label: "Airlines" },
  { id: "banks", label: "Banks" },
  { id: "auto", label: "Autos" },
  { id: "it", label: "IT services" },
  { id: "pharma", label: "Pharma" },
  { id: "fmcg", label: "Consumer" },
];

// Portfolio value in rupees.
export const PORTFOLIO_VALUE = 0;

// No demo holdings are loaded. Users must import or enter their own portfolio.
export const HOLDINGS = [];

// Expected sector move (percent) for each shock.
export const SECTOR_IMPACT = {
  oil: { energy: 6.5, airlines: -12, banks: -2.2, auto: -5.8, it: -0.8, pharma: -0.5, fmcg: -3.4 },
  rates: { energy: -0.8, airlines: -2.5, banks: -4.8, auto: -6.2, it: -2.1, pharma: -0.4, fmcg: -1.6 },
  conflict: { energy: 4.2, airlines: -9, banks: -4.1, auto: -3.3, it: -3.8, pharma: 1.2, fmcg: -1.4 },
  scandal: { energy: 0, airlines: 0, banks: -3.1, auto: -14, it: 0, pharma: 0, fmcg: -0.6 },
};

// Where each shock enters the graph.
export const ORIGIN = { oil: 0, rates: 1, conflict: 2, scandal: 3 };

// Links a sector view of the portfolio would miss.
export const HIDDEN_LINKS = [
  { from: "banks", to: "tata", note: "Auto loans are funded by banks you also hold." },
  { from: "energy", to: "indigo", note: "Jet fuel is a large share of airline costs." },
];

export const holdingImpact = (shock, h) => Math.round(SECTOR_IMPACT[shock][h.sector] * h.beta * 10) / 10;

export const portfolioImpact = (shock) =>
  Math.round(HOLDINGS.reduce((s, h) => s + (h.weight / 100) * holdingImpact(shock, h), 0) * 10) / 10;

export const inr = (n) => "\u20B9" + Math.round(n).toLocaleString("en-IN");
export const pct = (n, d = 1) => `${n > 0 ? "+" : n < 0 ? "\u2212" : ""}${Math.abs(n).toFixed(d)}%`;

// Smooth crisis curve used by the replay and landing charts.
export function crisisCurve(depth, recover, n = 61) {
  const out = [];
  for (let t = 0; t < n; t++) {
    let v;
    if (t < 8) v = 100 - t * 0.35;
    else if (t < 32) {
      const k = (t - 8) / 24;
      v = 97.2 - depth * (1 - Math.pow(1 - k, 1.6));
    } else v = 97.2 - depth + (t - 32) * recover;
    v += Math.sin(t * 1.7) * 0.5 + Math.sin(t * 0.63) * 0.7;
    out.push(Math.round(v * 10) / 10);
  }
  return out;
}
