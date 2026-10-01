const express = require('express');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

// file-type is ESM-only, so load it lazily instead of with top-level await.
let _ft;
const fileTypeFromBuffer = async (buf) => {
  _ft ??= await import('file-type');
  return _ft.fileTypeFromBuffer(buf);
};

const { getGpsFromBuffer } = require('./src/exif');
const { analyzeImage } = require('./src/vision');
const { reverseGeocode } = require('./src/geocode');
const { mergeWithNominatim } = require('./src/merge');
const { buildMapsUrl } = require('./src/maps');
const config = require('./src/config');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 },
});

// Rate limiting: values come from env (defaults: 10 requests per minute per IP).
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  limit: Number(process.env.RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/locate', limiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/locate', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    // Validate the real file type (magic bytes), not the file extension.
    const buffer = req.file.buffer;
    const type = await fileTypeFromBuffer(buffer);
    if (!type || !config.ALLOWED_IMAGE_TYPES.includes(type.mime)) {
      return res.status(415).json({ error: 'Invalid image type. Only JPEG, PNG, WebP allowed.' });
    }

    let locationResult = null;
    let source = null;
    let confidence = 0;
    let clues = [];
    let coordinates = null;

    // Step 1: EXIF GPS (exact and free)
    if (config.USE_EXIF_GPS) {
      const gps = getGpsFromBuffer(buffer);
      if (gps) {
        try {
          const geo = await reverseGeocode(gps.lat, gps.lon);
          if (geo && geo.display_name) {
            const [country, state, city, place] = parseNominatimAddress(geo.address);
            locationResult = { country, state, city, place_name: place };
            source = 'exif';
            confidence = 1;
            clues = ['GPS coordinates from EXIF'];
            coordinates = { lat: gps.lat, lon: gps.lon };
          }
        } catch (e) {
          // fall through to the AI step
        }
      }
    }

    // Step 2: AI vision (Gemini, with Llama fallback handled inside analyzeImage)
    if (!locationResult) {
      let visionResult;
      try {
        visionResult = await analyzeImage(buffer, type.mime);
      } catch (err) {
        console.error('Vision failed:', err.message);
        return res.status(502).json({ error: 'Vision service unavailable.' });
      }

      if (!visionResult.determinable || !visionResult.country || visionResult.confidence < config.CONFIDENCE_THRESHOLD) {
        return res.json({
          status: 'undetermined',
          message: 'Unable to determine the location from this image.',
          confidence: visionResult.confidence || 0,
          clues: visionResult.clues || [],
        });
      }

      // Step 3: geocode the guess
      const placeText = [visionResult.place_name, visionResult.city, visionResult.state, visionResult.country]
        .filter(Boolean)
        .join(', ');
      let geo = null;
      try {
        geo = await geocodeByName(placeText);
      } catch (e) {
        // continue without coordinates
      }

      // Step 4: optional merge
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
          finalResult = await mergeWithNominatim(finalResult, geo);
        } catch (e) {
          // keep the vision output
        }
      }

      locationResult = finalResult;
      source = 'ai';
      confidence = Number(finalResult.confidence ?? visionResult.confidence) || 0;
      clues = visionResult.clues;
      coordinates = geo ? { lat: geo.lat, lon: geo.lon } : null;
    }

    // Step 5: response
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
      maps_url: buildMapsUrl(coordinates, locationResult),
    });
  } catch (err) {
    console.error('Error in /locate:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload errors (for example file too large) come here instead of the default HTML error page.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res
      .status(tooBig ? 413 : 400)
      .json({ error: tooBig ? `Image too large. Max ${config.MAX_UPLOAD_MB} MB.` : 'Upload error.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = config.APP_PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
module.exports = app;

function parseNominatimAddress(address) {
  const a = address || {};
  const country = a.country || null;
  const state = a.state || a.region || null;
  const city = a.city || a.town || a.village || a.hamlet || null;
  const place = a.road || a.suburb || a.neighbourhood || null;
  return [country, state, city, place];
}

async function geocodeByName(placeText) {
  if (!placeText) return null;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', placeText);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': config.GEOCODER_USER_AGENT, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(8000),
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