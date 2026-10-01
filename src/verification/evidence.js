// ==== FILEPATH: src/verification/evidence.js ====
/**
 * Build a normalised evidence object.
 *
 * @param {string} source       – e.g. 'VISION', 'OCR', 'EXIF'
 * @param {string} description  – human-readable clue text
 * @param {number} [strength]   – optional weight (default 1.0)
 * @returns {{ source: string, description: string, strength: number }}
 */
function buildEvidence(source, description, strength = 1.0) {
  return {
    source,       // 'VISION' | 'OCR' | 'EXIF'
    description,  // free-text clue
    strength,     // relevance weight
  };
}

module.exports = { buildEvidence };
