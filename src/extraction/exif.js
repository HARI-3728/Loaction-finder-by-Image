const { EXIF } = require('exifreader');

async function getGpsFromBuffer(buffer) {
  try {
    const tags = await EXIF.load(buffer);
    const gpsInfo = tags.get('GPSInfo');
    if (!gpsInfo) return null;

    const lat = gpsInfo.latitude;
    const lon = gpsInfo.longitude;
    const latRef = gpsInfo.latitudeRef;
    const lonRef = gpsInfo.longitudeRef;

    if (lat == null || lon == null) return null;

    const signLat = latRef === 'S' ? -1 : 1;
    const signLon = lonRef === 'W' ? -1 : 1;

    // Validate ranges
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

    return {
      latitude: lat * signLat,
      longitude: lon * signLon,
    };
  } catch (_) {
    return null;
  }
}

module.exports = { getGpsFromBuffer };