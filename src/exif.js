// src/exif.js — EXIF GPS extraction
// Usage: getGpsFromBuffer(buffer) → { lat, lon } | null

function getGpsFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  try {
    const tags = require('exifreader').load(buffer, { expanded: true });
    const gps = tags.GPS;
    if (!gps) return null;
    const lat = decodeGpsCoordinate(gps.GPSLatitude, gps.GPSLatitudeRef);
    const lon = decodeGpsCoordinate(gps.GPSLongitude, gps.GPSLongitudeRef);
    if (lat === null || lon === null) return null;
    return { lat, lon };
  } catch (err) {
    return null; // silently ignore corrupt EXIF
  }
}

function decodeGpsCoordinate(coordinateTag, refTag) {
  if (!coordinateTag || !coordinateTag.value) return null;
  const vals = coordinateTag.value;
  if (!Array.isArray(vals) || vals.length < 3) return null;
  const toDeg = (v) => {
    if (v && v.numerator !== undefined && v.denominator !== undefined) {
      return v.numerator / v.denominator;
    }
    return Number(v) || 0;
  };
  let deg = toDeg(vals[0]);
  let min = toDeg(vals[1]);
  let sec = toDeg(vals[2]);
  let decimal = deg + min / 60 + sec / 3600;
  const ref = refTag && refTag.value ? String(refTag.value).toUpperCase() : 'N';
  if (ref === 'S' || ref === 'W') decimal = -decimal;
  return round(decimal, 6);
}

function round(v, d) {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

module.exports = { getGpsFromBuffer };


