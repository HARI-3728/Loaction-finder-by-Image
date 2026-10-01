// ==== FILEPATH: src/geolocation/candidate_generator.js ====
/**
 * Produce a list of candidate location objects from vision output and optional
 * EXIF GPS data.  Does not commit to a final answer – later scoring stages
 * evaluate and rank these candidates.
 *
 * @param {Object}      visionResult – validated result from the vision step
 * @param {Object|null} exifGps      – { lat, lon } extracted from EXIF (or null)
 * @returns {Object[]}               – array of partial location objects
 */
function generateCandidates(visionResult, exifGps) {
  const candidates = [];

  // 1️⃣ If EXIF GPS is present, create a candidate anchored to those coordinates.
  //    We still annotate it with vision-derived names so the scorer can match them.
  if (exifGps) {
    candidates.push({
      source:     'EXIF_GPS',
      latitude:   exifGps.lat,
      longitude:  exifGps.lon,
      country:    visionResult.country    ?? null,
      state:      visionResult.state      ?? null,
      city:       visionResult.city       ?? null,
      place_name: visionResult.place_name ?? null,
    });
  }

  // 2️⃣ Vision-derived candidate (no coordinates, but has place names)
  if (visionResult.place_name || visionResult.city || visionResult.country) {
    candidates.push({
      source:     'VISION',
      latitude:   null,
      longitude:  null,
      country:    visionResult.country    ?? null,
      state:      visionResult.state      ?? null,
      city:       visionResult.city       ?? null,
      place_name: visionResult.place_name ?? null,
    });
  }

  // Future OCR-derived candidates can be appended here.

  return candidates;
}

module.exports = { generateCandidates };
