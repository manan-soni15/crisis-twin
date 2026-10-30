// lib/server/propagation-engine.js
// Multi-hop shock propagation engine with BFS decay and hidden exposure detection.
// Based on the Portfolio Crisis Twin Blueprint (Page 7).

export const MACRO_SHOCKS = [
  { id: 'oil', label: 'Oil +25%', name: 'Oil price spike', originIndex: 0 },
  { id: 'rates', label: 'Rates +100 bps', name: 'Interest-rate hike', originIndex: 1 },
  { id: 'conflict', label: 'Conflict', name: 'Geopolitical conflict', originIndex: 2 },
  { id: 'scandal', label: 'Scandal', name: 'Major company scandal', originIndex: 3 },
];

export const SECTORS = [
  { id: 'energy', label: 'Energy' },
  { id: 'airlines', label: 'Airlines' },
  { id: 'banks', label: 'Banks' },
  { id: 'auto', label: 'Autos' },
  { id: 'it', label: 'IT services' },
  { id: 'pharma', label: 'Pharma' },
  { id: 'fmcg', label: 'Consumer' },
];

// Baseline factor-to-sector transmission matrix (impact in percent)
export const SECTOR_TRANSMISSION = {
  oil: {
    energy: 6.5,
    airlines: -12.0,
    banks: -2.2,
    auto: -5.8,
    it: -0.8,
    pharma: -0.5,
    fmcg: -3.4,
  },
  rates: {
    energy: -0.8,
    airlines: -2.5,
    banks: -4.8,
    auto: -6.2,
    it: -2.1,
    pharma: -0.4,
    fmcg: -1.6,
  },
  conflict: {
    energy: 4.2,
    airlines: -9.0,
    banks: -4.1,
    auto: -3.3,
    it: -3.8,
    pharma: 1.2,
    fmcg: -1.4,
  },
  scandal: {
    energy: 0.0,
    airlines: 0.0,
    banks: -3.1,
    auto: -14.0,
    it: 0.0,
    pharma: 0.0,
    fmcg: -0.6,
  },
};

// Curated indirect and cross-sector supply-chain / financing links
export const HIDDEN_EXPOSURE_LINKS = [
  {
    from: 'banks',
    to: 'tata',
    targetSector: 'auto',
    note: 'Auto loans are funded by banks you also hold. Credit tightening hits vehicle sales directly.',
    strength: 0.75,
  },
  {
    from: 'energy',
    to: 'indigo',
    targetSector: 'airlines',
    note: 'Jet fuel accounts for 35-40% of airline operating costs. Crude spikes squeeze margins immediately.',
    strength: 0.85,
  },
  {
    from: 'it',
    to: 'hdfc',
    targetSector: 'banks',
    note: 'Banking digitization and IT vendor costs expose financial institutions to IT sector margin pressures.',
    strength: 0.45,
  },
  {
    from: 'energy',
    to: 'itc',
    targetSector: 'fmcg',
    note: 'Packaging, agricultural transport, and raw commodity input costs rise when energy costs surge.',
    strength: 0.55,
  },
];

/**
 * Run BFS propagation algorithm across the macro -> sector -> holding graph
 * @param {string} shockId - 'oil' | 'rates' | 'conflict' | 'scandal' | custom
 * @param {Array} userHoldings - array of holdings from portfolio(db)
 */
export function runPropagation(shockId = 'oil', userHoldings = []) {
  const shockMeta = MACRO_SHOCKS.find((s) => s.id === shockId) || MACRO_SHOCKS[0];
  const sectorImpact = SECTOR_TRANSMISSION[shockId] || SECTOR_TRANSMISSION.oil;

  // Compute holding impacts using user's actual holdings and betas
  const holdingImpacts = userHoldings.map((h) => {
    const sectorVal = sectorImpact[h.sector] ?? 0;
    const beta = Number(h.beta) || 1.0;
    const directImpact = Math.round(sectorVal * beta * 10) / 10;

    // Check for indirect link adjustments
    const indirectLink = HIDDEN_EXPOSURE_LINKS.find((l) => l.to === h.id || l.targetSector === h.sector);
    let indirectImpact = 0;
    if (indirectLink && sectorImpact[indirectLink.from]) {
      const parentVal = sectorImpact[indirectLink.from];
      indirectImpact = Math.round(parentVal * indirectLink.strength * 0.6 * beta * 10) / 10;
    }

    const totalCalculated = Math.round((directImpact + indirectImpact * 0.25) * 10) / 10;

    return {
      id: h.id,
      name: h.name,
      ticker: h.ticker,
      sector: h.sector,
      weight: h.weight,
      beta,
      impact_pct: directImpact,
      composite_impact_pct: totalCalculated,
      has_indirect: Boolean(indirectLink && Math.abs(sectorImpact[indirectLink.from]) >= 1),
    };
  });

  // Calculate Strongest Paths
  const paths = holdingImpacts
    .filter((x) => Math.abs(x.impact_pct) >= 0.5)
    .sort((a, b) => Math.abs(b.impact_pct) - Math.abs(a.impact_pct))
    .slice(0, 4)
    .map((h) => {
      const sectorObj = SECTORS.find((s) => s.id === h.sector);
      return {
        holding_id: h.id,
        name: h.name,
        sector: sectorObj?.label || h.sector,
        path_nodes: [shockMeta.name, sectorObj?.label || h.sector, h.name],
        impact_pct: h.impact_pct,
      };
    });

  // Filter Active Hidden Exposures
  // Only include hidden links where the parent sector is significantly affected AND user owns the target holding
  const activeHidden = HIDDEN_EXPOSURE_LINKS.filter((l) => {
    const parentAffected = Math.abs(sectorImpact[l.from] || 0) >= 1;
    const userOwnsTarget = userHoldings.some((h) => h.id === l.to || h.sector === l.targetSector);
    return parentAffected && userOwnsTarget;
  }).map((l) => {
    const fromSector = SECTORS.find((s) => s.id === l.from)?.label || l.from;
    const targetHolding = userHoldings.find((h) => h.id === l.to)?.name || l.to;
    return {
      from: l.from,
      from_label: fromSector,
      to: l.to,
      to_label: targetHolding,
      path_nodes: [fromSector, targetHolding],
      note: l.note,
    };
  });

  return {
    shock: shockMeta,
    sector_impact: sectorImpact,
    holding_impacts: holdingImpacts,
    strongest_paths: paths,
    hidden_exposures: activeHidden,
    sectors: SECTORS,
  };
}

