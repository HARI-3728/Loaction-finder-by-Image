// ==== FILEPATH: src/verification/candidate_scorer.js ====
/**
 * Score each candidate location based on the available evidence.
 *
 * @param {Object[]} candidates – array from candidate_generator.js
 * @param {Object[]} evidence   – array of { source, description, strength }
 * @param {Object}   cfg        – scoring weights (WEIGHT_GPS, WEIGHT_OCR, etc.)
 * @returns {Object[]}          – candidates with an added `.score` and `.basis` field
 */
function scoreCandidates(candidates, evidence, cfg) {
  // Map each candidate to a scored copy
  const scored = candidates.map((candidate) => ({
    ...candidate,
    score: 0,
    basis: [],
  }));

  // ── GPS evidence ─────────────────────────────────────────────────────────
  const weight_gps = parseFloat(cfg.WEIGHT_GPS) || 1.0;
  scored.forEach((s) => {
    if (s.latitude != null) {
      s.score += weight_gps;
      s.basis.push(`GPS weight=${weight_gps}`);
    }
  });

  // ── OCR evidence ─────────────────────────────────────────────────────────
  const ocrEvidence = evidence.filter((e) => e.source === 'OCR');
  if (ocrEvidence.length > 0) {
    const weight_ocr = parseFloat(cfg.WEIGHT_OCR) || 1.0;
    ocrEvidence.forEach((ocr) => {
      scored.forEach((s, i) => {
        const nameMatch =
          s.place_name?.toLowerCase().includes(ocr.description.toLowerCase()) ||
          s.city?.toLowerCase().includes(ocr.description.toLowerCase());
        if (nameMatch) {
          s.score += weight_ocr * (ocr.strength ?? 1.0);
          s.basis.push(`OCR match "${ocr.description}" weight=${weight_ocr}`);
        }
      });
    });
  }

  // ── Vision agreement (number of distinct Vision clues) ───────────────────
  const visionClues = evidence.filter((e) => e.source === 'VISION');
  if (visionClues.length > 0) {
    const weight_va = parseFloat(cfg.WEIGHT_VISION_AGREEMENT) || 1.0;
    const visionBonus = weight_va * Math.min(visionClues.length / 3, 1.0); // cap at 1× weight
    scored.forEach((s) => {
      if (s.source === 'VISION' || s.source === 'EXIF_GPS') {
        s.score += visionBonus;
        s.basis.push(`Vision clues(${visionClues.length}) weight=${visionBonus.toFixed(2)}`);
      }
    });
  }

  return scored;
}

module.exports = { scoreCandidates };
