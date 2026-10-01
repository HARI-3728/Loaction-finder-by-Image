// src/maps.js — Google Maps URL builder (no API key needed)
// Usage: buildMapsUrl({ lat, lon }) → string
//        buildMapsUrl({ placeText }) → string

/**
 * Build a Google Maps search URL.
 * @param {Object} opts
 * @param {number} [opts.lat]
 * @param {number} [opts.lon]
 * @param {string} [opts.placeText]
 * @returns {string}
 */
function buildMapsUrl({ lat, lon, placeText } = {}) {
  if (typeof lat === 'number' && typeof lon === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }
  if (placeText && typeof placeText === 'string' && placeText.trim()) {
    const query = encodeURIComponent(placeText.trim());
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
  return '';
}

module.exports = { buildMapsUrl };