const express = require('express');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { fileTypeFromBuffer } = await import('file-type');
const {
  extractExifGps,
  getLocationFromExif,
} = require('./src/exif');
const {
  analyzeWithGemini,
  analyzeWithFallback,
} = require('./src/vision');
const { reverseGeocode } = require('./src/geocode');
const { mergeWithNominatim } = require('./src/merge');
const { buildMapsUrl } = require('./src/maps');
const { validateImage } = require('./src/utils');
const config = require('./src/config');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 } });

// Rate limiting (basic)
const locateRequests = new Map();
app.use('/locate', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = config.GEOCODER_RATE_LIMIT_MS * 2; // simple window
  const requests = (locateRequests.get(ip) || []).filter(t => now - t < windowMs);
  if (requests.length >= 2) {
    return res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
  requests.push(now);
  locateRequests.set(ip, requests);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main endpoint
app.post('/locate', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    // Validate file type
    const buffer = req.file.buffer;
    const type = await fileTypeFromBuffer(buffer);
    if (!type || !config.ALLOWED_IMAGE_TYPES.includes(type.mime)) {
      return res.status(415).json({ error: 'Invalid image type. Only JPEG, PNG, WebP allowed.' });
    }

    // Validate dimensions and size via sharp
    await validateImage(buffer);

    let locationResult = null;
    let source = null;
    let confidence = 0;
    let clues = [];
    let coordinates = null;

    // Step 1: EXIF GPS
    if (config.USE_EXIF_GPS) {
      const gps = extractExifGps(buffer);
      if (gps) {
        try {
          const geo = await reverseGeocode(gps.lat, gps.lon);
          if (geo && geo.display_name) {
            const [country, state, city, place] = parseNominatimAddress(geo.address);
            locationResult = {
              country,
              state,
              city,
              place_name: place,
              confidence: 1.0,
              clues: ['GPS coordinates from EXIF'],
            };
            source = 'exif';
            coordinates = { lat: gps.lat, lon: gps.lon };
          }
        } catch (e) {
          // Continue to AI if geocoding fails
        }
      }
    }

    // Step 2: AI vision if EXIF didn't give us a result
    if (!locationResult) {
      let visionResult;
      try {
        visionResult = await analyzeWithGemini(buffer, config.VISION_TIMEOUT_MS);
      } catch (primaryError) {
        if (config.VISION_FALLBACK_MODEL && config.OPENROUTER_API_KEY) {
          try {
            visionResult = await analyzeWithFallback(buffer, config.VISION_FALLBACK_MODEL, config.VISION_TIMEOUT_MS);
          } catch (fallbackError) {
            return res.status(502).json({ error: 'Vision service unavailable.' });
          }
        } else {
          return res.status(502).json({ error: 'Vision service unavailable.' });
        }
      }

      if (!visionResult.determinable || !visionResult.country || visionResult.confidence < config.CONFIDENCE_THRESHOLD) {
        return res.json({
          status: 'undetermined',
          message: 'Unable to determine the location from this image.',
          confidence: visionResult.confidence || 0,
          clues: visionResult.clues || [],
        });
      }

      // Step 3: Geocode the vision result
      const placeText = `${visionResult.place_name || ''}, ${visionResult.city || ''}, ${visionResult.state || ''}, ${visionResult.country}`.trim().replace(/^,+|,+$/g, '');
      let geo = null;
      if (placeText) {
        try {
          geo = await reverseGeocodeByName(placeText);
        } catch (e) {
          // Continue without coordinates
        }
      }

      // Step 4: Optional merge
      let finalResult = {
        country: visionResult.country,
        state: visionResult.state,
        city: visionResult.city,
        place_name: visionResult.place_name,
        confidence: visionResult.confidence,
        clues: visionResult.clues,
      };

      if (config.ENABLE_MERGE && geo && geo.address) {
        try {
          const merged = await mergeWithNominatim(finalResult, geo);
          finalResult = merged;
        } catch (e) {
          // Silently keep vision output
        }
      }

      locationResult = finalResult;
      source = 'ai';
      confidence = visionResult.confidence;
      clues = visionResult.clues;
      coordinates = geo ? { lat: geo.lat, lon: geo.lon } : null;
    }

    // Step 5: Build response
    const mapsUrl = buildMapsUrl(coordinates, locationResult);
    res.json({
      status: 'ok',
      country: locationResult.country,
      state: locationResult.state,
      city: locationResult.city,
      place_name: locationResult.place_name,
      confidence: Number(confidence.toFixed(3)),
      source,
      clues,
      coordinates,
      maps_url: mapsUrl,
    });
  } catch (err) {
    console.error('Error in /locate:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = config.APP_PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Helper: parse Nominatim address into components
function parseNominatimAddress(address) {
  const country = address.country || null;
  const state = address.state || address.region || null;
  const city = address.city || address.town || address.village || address.hamlet || null;
  // Place name: try to get something meaningful like road, suburb, etc.
  const place = address.road || address.suburb || address.neighbourhood || null;
  return [country, state, city, place];
}

// Helper: reverse geocode by place name
async function reverseGeocodeByName(placeText) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', placeText);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': config.GEOCODER_USER_AGENT },
    timeout: 5000,
  });
  if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);
  const data = await response.json();
  if (data.length === 0) throw new Error('Place not found');
  const [first] = data;
  return {
    lat: parseFloat(first.lat),
    lon: parseFloat(first.lon),
    display_name: first.display_name,
    address: first.address,
  };
}