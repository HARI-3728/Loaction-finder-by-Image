function buildMapsUrl(location) {
  if (!location || typeof location !== 'object') {
    return '';
  }

  // GPS coordinates
  const lat = Number(location.lat);
  const lon = Number(location.lon);

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }

  // Place text
  if (location.placeText) {
    const placeText = String(location.placeText).trim();

    if (placeText) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeText)}`;
    }
  }

  // Application location fields
  const parts = [
    location.place_name,
    location.city,
    location.state,
    location.country
  ]
    .filter(value => value !== null && value !== undefined && String(value).trim())
    .map(value => String(value).trim());

  if (parts.length === 0) {
    return '';
  }

  const query = [...new Set(parts)].join(', ');

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

module.exports = { buildMapsUrl };
