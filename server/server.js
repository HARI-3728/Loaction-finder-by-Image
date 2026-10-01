// ==== FILEPATH: server/server.js ====
/*
 * Main Express entry point.
 * – Rate-limit (env-controlled)
 * – Serves static assets from ./public
 * – /health endpoint
 * – POST /locate executes the full evidence-based pipeline
 */

require('dotenv').config(); // load .env (if present)

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const rateLimit = require('express-rate-limit');

const CONFIG = require('../src/config.js');

// Pipeline modules
const { getGpsFromBuffer }      = require('../src/exif.js');
const { callVision }            = require('../src/vision/model_router.js');
const { forwardGeocode }        = require('../src/geocode.js');
const { buildMapsUrl }          = require('../src/maps.js');
const { merge: callMergeProvider } = require('../src/merge.js');

// Verification modules (created as part of this blueprint)
const { detectContradictions }  = require('../src/verification/contradiction.js');
const { generateCandidates }    = require('../src/geolocation/candidate_generator.js');
const { scoreCandidates }       = require('../src/verification/candidate_scorer.js');
const { calculateConfidence }   = require('../src/verification/confidence.js');

// ─────────────────────────────────────────────────────────────────────────────
// App setup
// ─────────────────────────────────────────────────────────────────────────────
const app  = express();
const PORT = parseInt(process.env.PORT, 10) || CONFIG.APP_PORT || 3000;

// Rate-limit middleware
const limiter = rateLimit({
  windowMs: CONFIG.RATE_LIMIT_WINDOW_MS,
  max:      CONFIG.RATE_LIMIT_MAX,
});
app.use(limiter);

// ─────────────────────────────────────────────────────────────────────────────
// Multer – memory storage so req.file.buffer is available
// ─────────────────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      const err = new Error('Invalid file type – only image uploads are accepted');
      err.status = 415;
      return cb(err, false);
    }
    cb(null, true);
  },
  limits: { fileSize: CONFIG.MAX_UPLOAD_MB * 1024 * 1024 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Static assets (HTML / CSS / JS)
app.use(express.static(path.join(__dirname, '..', 'public')));

// POST /locate – full evidence-based pipeline
app.post('/locate', upload.single('image'), async (req, res) => {
  try {
    // ── 0️⃣ Guard ────────────────────────────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // ── 1️⃣ EXIF GPS extraction (optional, non-fatal) ────────────────────────
    let exifGps = null;
    if (CONFIG.USE_EXIF_GPS) {
      try {
        exifGps = getGpsFromBuffer(req.file.buffer);
      } catch (e) {
        console.warn('[LOCATE] EXIF extraction error (non-fatal):', e.message);
      }
    }

    // ── 2️⃣ Vision (primary Gemini → fallback OpenRouter) ────────────────────
    let visionResult;
    try {
      visionResult = await callVision(req.file.buffer, CONFIG);
    } catch (visionErr) {
      // All providers failed – return a safe "undetermined" payload (no 502)
      console.error('[LOCATE] All vision providers failed:', visionErr.message);
      return res.json({
        status:     'undetermined',
        message:    'Vision service unavailable – unable to determine location.',
        confidence: 0,
        clues:      [],
      });
    }

    // ── 3️⃣ Confidence gate ──────────────────────────────────────────────────
    if (!visionResult.determinable || visionResult.confidence < CONFIG.CONFIDENCE_THRESHOLD) {
      return res.json({
        status:     'undetermined',
        message:    'Unable to determine the location from this image.',
        confidence: visionResult.confidence ?? 0,
        clues:      visionResult.clues ?? [],
      });
    }

    // ── 4️⃣ Evidence assembly ────────────────────────────────────────────────
    const allEvidence = (visionResult.clues ?? []).map((desc) => ({
      source:      'VISION',
      description: desc,
      strength:    1.0,
    }));

    // ── 4a️⃣ Contradiction detection ─────────────────────────────────────────
    const contradictions = detectContradictions(allEvidence);

    // ── 5️⃣ Candidate generation ─────────────────────────────────────────────
    const candidates = generateCandidates(visionResult, exifGps);

    // ── 6️⃣ Candidate scoring ────────────────────────────────────────────────
    const cfg = {
      WEIGHT_GPS:              CONFIG.WEIGHT_GPS,
      WEIGHT_OCR:              CONFIG.WEIGHT_OCR,
      WEIGHT_LANDMARK:         CONFIG.WEIGHT_LANDMARK,
      WEIGHT_VISION_AGREEMENT: CONFIG.WEIGHT_VISION_AGREEMENT,
      CONFIDENCE_THRESHOLD:    CONFIG.CONFIDENCE_THRESHOLD,
    };
    const scored       = scoreCandidates(candidates, allEvidence, cfg);
    const bestCandidate = scored.sort((a, b) => b.score - a.score)[0] ?? {};

    // ── 7️⃣ Confidence calculation ────────────────────────────────────────────
    const confidenceInfo = calculateConfidence({
      score:         bestCandidate.score ?? 0,
      contradictions,
      evidence:      allEvidence,
      cfg,
    });

    // ── 8️⃣ Optional merge step ──────────────────────────────────────────────
    if (CONFIG.ENABLE_MERGE) {
      try {
        const merged = await callMergeProvider(visionResult, {});
        if (merged) {
          if (merged.country)     bestCandidate.country     = merged.country;
          if (merged.state)       bestCandidate.state       = merged.state;
          if (merged.city)        bestCandidate.city        = merged.city;
          if (merged.place_name)  bestCandidate.place_name  = merged.place_name;
          if (merged.confidence)  bestCandidate.confidence  = merged.confidence;
        }
      } catch (mergeErr) {
        console.warn('[LOCATE] Merge step failed – continuing without merge:', mergeErr.message);
      }
    }

    // ── 9️⃣ Geocoding ────────────────────────────────────────────────────────
    let geoResult = { lat: null, lon: null, display_name: null };
    const placeQuery = [
      bestCandidate.country,
      bestCandidate.state,
      bestCandidate.city,
      bestCandidate.place_name,
    ]
      .filter(Boolean)
      .join(', ');

    if (placeQuery) {
      try {
        const geo = await forwardGeocode(placeQuery);
        if (geo) geoResult = geo;
      } catch (geoErr) {
        console.warn('[LOCATE] Geocoding failed – continuing without coordinates:', geoErr.message);
      }
    }

    // ── 🔟 Final response ────────────────────────────────────────────────────
    return res.json({
      status:             'ok',
      determinable:       bestCandidate.determinable ?? confidenceInfo.determinable ?? false,
      country:            bestCandidate.country    ?? visionResult.country    ?? null,
      state:              bestCandidate.state      ?? visionResult.state      ?? null,
      city:               bestCandidate.city       ?? visionResult.city       ?? null,
      place_name:         bestCandidate.place_name ?? visionResult.place_name ?? null,
      confidence:         confidenceInfo.confidence,
      confidence_level:   confidenceInfo.level,
      clues:              visionResult.clues ?? [],
      clues_used:         allEvidence.map((e) => e.description),
      contradictions:     contradictions.map(({ description, sources, severity }) => ({
        description,
        sources,
        severity,
      })),
      coordinates: {
        lat: geoResult.lat ?? null,
        lon: geoResult.lon ?? null,
      },
      maps_url: buildMapsUrl(
        geoResult.lat ?? null,
        geoResult.lon ?? null,
        geoResult.display_name ?? placeQuery ?? null,
      ),
    });
  } catch (unexpectedErr) {
    console.error('[LOCATE] Unexpected error:', unexpectedErr.stack);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Generic error handler (catches multer errors such as invalid MIME type)
app.use((err, _req, res, _next) => {
  console.error('[UNHANDLED ERROR]', err.message);
  const status = err.status ?? 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});

module.exports = app; // exported for tests