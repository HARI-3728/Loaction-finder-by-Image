// src/geocode.js — Nominatim reverse geocode and forward geocode
// Usage: reverseGeocode(lat, lon) → { lat, lon, display_name, address }
//        forwardGeocode(placeText) → { lat, lon, display_name, address }

const config = require('./config');

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
let lastRequestTime = 0;

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < config.GEOCODER_RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, config.GEOCODER_RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

async function fetchJson(url) {
  await rateLimit();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': config.GEOCODER_USER_AGENT },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      throw new Error(`Nominatim HTTP ${resp.status}`);
    }
    return await resp.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Nominatim timeout');
    throw err;
  }
}

/**
 * Reverse geocode lat/lon to address
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{lat:number, lon:number, display_name:string, address:Object}|null>}
 */
async function reverseGeocode(lat, lon) {
  const url = new URL(`${NOMINATIM_BASE}/reverse`);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'en');

  const data = await fetchJson(url);
  if (!data || !data.lat || !data.lon) return null;

  return {
    lat: parseFloat(data.lat),
    lon: parseFloat(data.lon),
    display_name: data.display_name || '',
    address: data.address || {}
  };
}

/**
 * Forward geocode place name to coordinates
 * @param {string} placeText
 * @returns {Promise<{lat:number, lon:number, display_name:string, address:Object}|null>}
 */
async function forwardGeocode(placeText) {
  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set('q', placeText);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'en');

  const data = await fetchJson(url);
  if (!data || data.length === 0) return null;

  const [first] = data;
  return {
    lat: parseFloat(first.lat),
    lon: parseFloat(first.lon),
    display_name: first.display_name || '',
    address: first.address || {}
  };
}

/** Alias: resolve a free-form place name string to coordinates (same as forwardGeocode). */
const reverseGeocodeFromPlace = forwardGeocode;

module.exports = { reverseGeocode, forwardGeocode, reverseGeocodeFromPlace };