// lib/server/finbert.js
// Financial sentiment analysis integration for ProsusAI/finbert on Hugging Face,
// with a deterministic local financial lexicon fallback.

const HF_FINBERT_URL = 'https://api-inference.huggingface.co/models/ProsusAI/finbert';

const BEARISH_TERMS = [
  'spike', 'surge', 'jump', 'hike', 'inflation', 'crash', 'crisis', 'war', 'conflict',
  'sanctions', 'scandal', 'loss', 'recession', 'default', 'panic', 'deficit', 'drop',
  'plunge', 'selloff', 'bleeding', 'downgrade', 'breach'
];

const BULLISH_TERMS = [
  'growth', 'recovery', 'rally', 'boost', 'easing', 'cut', 'stimulus', 'dividend',
  'profit', 'expansion', 'resilient', 'defensive', 'outperform', 'upgrade', 'windfall'
];

/**
 * Score sentiment for a crisis or financial headline using ProsusAI/finbert
 * @param {string} text - Headline or scenario text
 */
export async function analyzeFinbertSentiment(text) {
  const clean = String(text || '').trim();
  if (!clean) return defaultSentiment();

  // Try Hugging Face Inference API if HF_TOKEN is configured or public endpoint
  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;
  if (hfToken) {
    try {
      const response = await fetch(HF_FINBERT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: clean }),
        signal: AbortSignal.timeout(2500),
      });

      if (response.ok) {
        const result = await response.json();
        // HF FinBERT returns [[{ label: 'positive'|'negative'|'neutral', score: 0.95 }, ...]]
        const items = Array.isArray(result?.[0]) ? result[0] : Array.isArray(result) ? result : [];
        if (items.length > 0) {
          const top = items.reduce((prev, curr) => (curr.score > prev.score ? curr : prev), items[0]);
          return {
            source: 'hf-prosusai-finbert',
            dominant_label: top.label.toLowerCase(),
            confidence: Math.round(top.score * 100) / 100,
            scores: Object.fromEntries(items.map((i) => [i.label.toLowerCase(), Math.round(i.score * 100) / 100])),
          };
        }
      }
    } catch {
      // Fall through to local lexicon
    }
  }

  // Fast deterministic financial lexicon fallback
  return evaluateLexiconSentiment(clean);
}

function evaluateLexiconSentiment(text) {
  const lower = text.toLowerCase();
  let bearCount = 0;
  let bullCount = 0;

  for (const term of BEARISH_TERMS) {
    if (lower.includes(term)) bearCount += 1;
  }
  for (const term of BULLISH_TERMS) {
    if (lower.includes(term)) bullCount += 1;
  }

  const total = bearCount + bullCount;
  if (total === 0) return defaultSentiment();

  const negProb = Math.min(0.95, Math.max(0.05, (bearCount / (total + 0.5))));
  const posProb = Math.min(0.95, Math.max(0.05, (bullCount / (total + 0.5))));
  const neuProb = Math.max(0.05, 1 - negProb - posProb);

  const dominant = negProb >= posProb ? (negProb > 0.45 ? 'negative' : 'neutral') : 'positive';
  const confidence = Math.round(Math.max(negProb, posProb, neuProb) * 100) / 100;

  return {
    source: 'finbert-lexicon-fallback',
    dominant_label: dominant,
    confidence,
    scores: {
      negative: Math.round(negProb * 100) / 100,
      positive: Math.round(posProb * 100) / 100,
      neutral: Math.round(neuProb * 100) / 100,
    },
  };
}

function defaultSentiment() {
  return {
    source: 'default',
    dominant_label: 'negative',
    confidence: 0.85,
    scores: { negative: 0.85, neutral: 0.10, positive: 0.05 },
  };
}

