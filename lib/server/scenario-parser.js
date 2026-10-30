// lib/server/scenario-parser.js
// Parses natural language scenario descriptions into structured shocks using Llama 3.1 8B on Groq,
// with an immediate rule-based fallback when Groq is unavailable.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_PARSER = 'openai/gpt-oss-20b';

export async function parseScenarioWithLlama(text) {
  const clean = String(text || '').trim();
  if (!clean) return null;

  const apiKey = process.env.GROQ_API_KEY;

  if (apiKey) {
    try {
      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL_PARSER,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are a financial crisis scenario parser. Convert the user's natural language scenario into a JSON object with:
{
  "scenario_name": "Concise headline (max 60 chars)",
  "shocks": [
    { "factor": "oil_price" | "policy_rate" | "usd_inr" | "volatility" | "geopolitical_risk", "change_pct"?: number, "change_bps"?: number, "confidence": number }
  ],
  "horizon_days": number (default 10)
}
Rules:
- For oil, factor is "oil_price", change_pct is positive for surge/spike, negative for drop.
- For rates/repo, factor is "policy_rate", change_bps is in basis points (+100 for 1% hike).
- For rupee/dollar/forex, factor is "usd_inr", change_pct is positive for depreciation.
- For market panic/vix, factor is "volatility", change_pct is positive.
- For war/sanctions, factor is "geopolitical_risk", change_pct is positive.
Output ONLY valid JSON.`,
            },
            {
              role: 'user',
              content: clean,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.shocks) && parsed.shocks.length > 0) {
            return {
              scenario_name: parsed.scenario_name || clean.slice(0, 80),
              shocks: parsed.shocks,
              horizon_days: Number(parsed.horizon_days) || 10,
              parser_source: 'groq-live',
            };
          }
        }
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback Rule-based parser
  return parseScenarioRules(clean);
}

export function parseScenarioRules(text) {
  const s = String(text || '').trim();
  const l = s.toLowerCase();
  const shocks = [];
  let m;

  // Oil
  m = l.match(/(?:oil|crude)(?:\s+prices?)?.{0,35}?(\d+(?:\.\d+)?)\s*%/);
  if (m || /\b(oil|crude)\b/.test(l)) {
    const isDrop = /oil (?:fall|drop|slump|crash)|crude (?:fall|drop)/.test(l);
    shocks.push({
      factor: 'oil_price',
      change_pct: Math.round((m ? Number(m[1]) : 25) * (isDrop ? -1 : 1) * 10) / 10,
      confidence: 0.85,
    });
  }

  // Interest Rates
  m = l.match(/(?:interest\s+)?rates?.{0,35}?(\d+(?:\.\d+)?)\s*(bps?|basis points?|%)/);
  if (m) {
    shocks.push({
      factor: 'policy_rate',
      change_bps: Math.round(Number(m[1]) * (m[2] === '%' ? 100 : 1)),
      confidence: 0.8,
    });
  } else if (/\b(rate|rates|repo|interest|rbi hike|fed hike)\b/.test(l)) {
    shocks.push({ factor: 'policy_rate', change_bps: 100, confidence: 0.75 });
  }

  // FX / Rupee
  m = l.match(/(?:rupee|inr|fx|usd\/inr).{0,35}?(\d+(?:\.\d+)?)\s*%/);
  if (m) {
    shocks.push({ factor: 'usd_inr', change_pct: Number(m[1]), confidence: 0.8 });
  } else if (/rupee falls|currency crash|rupee deprec/.test(l)) {
    shocks.push({ factor: 'usd_inr', change_pct: 5, confidence: 0.7 });
  }

  // Volatility
  m = l.match(/(?:volatility|vix).{0,35}?(\d+(?:\.\d+)?)\s*%/);
  if (m) {
    shocks.push({ factor: 'volatility', change_pct: Number(m[1]), confidence: 0.8 });
  } else if (/panic|selloff|market crash|bloodbath/.test(l)) {
    shocks.push({ factor: 'volatility', change_pct: 35, confidence: 0.8 });
  }

  // Geopolitical
  if (/conflict|war|geopolitical|sanctions|strait|escalat/.test(l)) {
    shocks.push({ factor: 'geopolitical_risk', change_pct: 30, confidence: 0.75 });
  }

  if (!shocks.length) {
    // Default fallback so every input can produce a shock
    shocks.push({ factor: 'oil_price', change_pct: 25, confidence: 0.6 });
  }

  m = l.match(/(\d+)\s*(?:day|days|d)\b/);
  const horizon = Math.max(1, Math.min(90, m ? Number(m[1]) : 10));

  return {
    scenario_name: s.slice(0, 80),
    shocks,
    horizon_days: horizon,
    parser_source: 'rule-based',
  };
}

