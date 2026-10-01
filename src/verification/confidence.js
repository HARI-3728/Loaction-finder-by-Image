// ==== FILEPATH: src/verification/confidence.js ====
/**
 * Calculate a normalised confidence value and a human-readable level from a
 * candidate's score and the surrounding evidence context.
 *
 * @param {Object}   opts
 * @param {number}   opts.score           – raw numeric score from scoreCandidates
 * @param {Object[]} opts.contradictions  – array of detected contradictions
 * @param {Object[]} opts.evidence        – full evidence array
 * @param {Object}   opts.cfg             – config with CONFIDENCE_THRESHOLD, weights, etc.
 * @returns {{ confidence: number, level: string, determinable: boolean }}
 */
function calculateConfidence({ score, contradictions = [], evidence = [], cfg = {} }) {
  const threshold = parseFloat(cfg.CONFIDENCE_THRESHOLD) || 0.4;

  // Normalise score to [0, 1] using a simple cap at 3 (adjust as pipeline matures)
  const normalised = Math.min(score / 3, 1.0);

  // Determine confidence level
  let level = normalised >= threshold ? 'high' : normalised >= 0.2 ? 'medium' : 'low';

  // High-severity contradictions downgrade the level by one step
  const hasHighSeverityContradiction = contradictions.some((c) => c.severity === 'high');
  if (hasHighSeverityContradiction) {
    if (level === 'high')   level = 'medium';
    else if (level === 'medium') level = 'low';
  }

  // Only treat the result as determinable when we have a non-zero score AND
  // at least one piece of Vision evidence
  const visionClues = evidence.filter((e) => e.source === 'VISION');
  const determinable = normalised > 0 && visionClues.length > 0;

  return {
    confidence:   parseFloat(normalised.toFixed(2)),
    level,
    determinable,
  };
}

module.exports = { calculateConfidence };
