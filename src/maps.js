// ==== FILEPATH: src/maps.js ====
/**
 * Build a Google Maps search URL.
 *
 * Supports two calling conventions:
 *
 *   1. buildMapsUrl(lat, lon, place_name)   – individual args (used by server.js)
 *   2. buildMapsUrl(locationObj)            – { lat, lon, placeText, place_name, city, … }
 *
 * @param {number|Object|null} latOrObj  – latitude OR location object
 * @param {number|null}        lon       – longitude (when using individual args)
 * @param {string|null}        placeName – free-form label (when using individual args)
 * @returns {string}                     – ready-to-use Google Maps URL
 */
function buildMapsUrl(latOrObj, lon, placeName) {
  const base = 'https://www.google.com/maps/search/?api=1';

  // ── Detect calling convention ──────────────────────────────────────────────
  let lat, placeText;

  if (latOrObj !== null && typeof latOrObj === 'object') {
    // Convention 2: single object
    lat       = Number(latOrObj.lat);
    lon       = Number(latOrObj.lon);
    placeText = latOrObj.placeText || latOrObj.place_name || latOrObj.display_name || null;

    // Fall back to structured fields
    if (!placeText) {
      const parts = [latOrObj.place_name, latOrObj.city, latOrObj.state, latOrObj.country]
        .filter((v) => v != null && String(v).trim())
        .map((v) => String(v).trim());
      placeText = [...new Set(parts)].join(', ') || null;
    }
  } else {
    // Convention 1: lat, lon, placeName as separate args
    lat       = latOrObj != null ? Number(latOrObj) : NaN;
    lon       = lon      != null ? Number(lon)      : NaN;
    placeText = placeName ?? null;
  }

  // ── Prefer exact coordinates ───────────────────────────────────────────────
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return `${base}&query=${lat},${lon}`;
  }

  // ── Fall back to place text ────────────────────────────────────────────────
  if (placeText && String(placeText).trim()) {
    return `${base}&query=${encodeURIComponent(String(placeText).trim())}`;
  }

  return '';
}

module.exports = { buildMapsUrl };
