// ==== FILEPATH: src/verification/contradiction.js ====
/**
 * Detect contradictions within a list of evidence items.
 * Each contradiction is flagged with a severity level ('high' | 'medium' | 'low').
 *
 * @param {Object[]} evidence – array of { source, description, strength } objects
 * @returns {Object[]}        – array of contradiction objects
 */
function detectContradictions(evidence) {
  const contradictions = [];

  // ── Country mismatch between OCR and Vision (high severity) ──────────────
  const ocrEntry    = evidence.find((e) => e.source === 'OCR');
  const visionEntry = evidence.find((e) => e.source === 'VISION');

  if (
    ocrEntry && visionEntry &&
    ocrEntry.description.toLowerCase() !== visionEntry.description.toLowerCase()
  ) {
    contradictions.push({
      description: 'Country mismatch between OCR and Vision evidence',
      sources:     ['OCR', 'VISION'],
      severity:    'high',
    });
  }

  // Additional conflict rules (state mismatch, city mismatch, etc.) can be
  // appended here as the pipeline matures.

  return contradictions;
}

module.exports = { detectContradictions };
