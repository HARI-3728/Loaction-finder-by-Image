// ==== FILEPATH: eval/evaluate.js ====
/**
 * Batch evaluation script.
 *
 * Usage:
 *   node eval/evaluate.js [--dir <photos-dir>] [--threshold <0-1>]
 *
 * Place labelled photos in eval/photos/ with filenames like:
 *   <city>_<country>_<any-suffix>.(jpg|jpeg|png|webp)
 * e.g.:
 *   paris_france_01.jpg
 *   tokyo_japan_02.jpg
 *
 * The script POSTs each photo to the running /locate endpoint, compares the
 * returned city/country against the filename label, and prints a summary.
 *
 * Requires the server to be running locally (npm start).
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const PHOTOS_DIR  = path.resolve(__dirname, 'photos');
const SERVER_PORT = parseInt(process.env.PORT, 10) || 3000;
const THRESHOLD   = parseFloat(process.env.EVAL_THRESHOLD) || 0.4;

const SUPPORTED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function getMimeType(ext) {
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png')  return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

/** POST a single image buffer to /locate and return the parsed JSON response */
function postImage(filename, buffer, mimeType) {
  return new Promise((resolve, reject) => {
    const boundary = '----EvalBoundary' + Date.now();
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
      ),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const options = {
      method:   'POST',
      hostname: 'localhost',
      port:     SERVER_PORT,
      path:     '/locate',
      headers:  {
        'Content-Type':   `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()));
        } catch (e) {
          reject(new Error(`Non-JSON response for ${filename}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Normalise a string for loose comparison */
function normalise(s) {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  if (!fs.existsSync(PHOTOS_DIR)) {
    console.error(`Photos directory not found: ${PHOTOS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(PHOTOS_DIR).filter((f) =>
    SUPPORTED_EXT.has(path.extname(f).toLowerCase())
  );

  if (files.length === 0) {
    console.log('No photos found in eval/photos/ – nothing to evaluate.');
    return;
  }

  console.log(`\n📸 Evaluating ${files.length} photo(s) against http://localhost:${SERVER_PORT}/locate\n`);

  let correct = 0;
  let total   = 0;

  for (const file of files) {
    const parts    = path.basename(file, path.extname(file)).split('_');
    const expected = { city: parts[0], country: parts[1] };

    const buffer   = fs.readFileSync(path.join(PHOTOS_DIR, file));
    const mimeType = getMimeType(path.extname(file).toLowerCase());

    let result;
    try {
      result = await postImage(file, buffer, mimeType);
    } catch (err) {
      console.log(`  ❌ ${file} – request failed: ${err.message}`);
      total++;
      continue;
    }

    const cityMatch    = normalise(result.city)    === normalise(expected.city);
    const countryMatch = normalise(result.country) === normalise(expected.country);
    const pass = cityMatch && countryMatch;

    if (pass) correct++;
    total++;

    const icon = pass ? '✅' : '❌';
    const conf = result.confidence != null ? `(conf: ${result.confidence})` : '';
    console.log(
      `  ${icon} ${file}\n` +
      `      Expected: city="${expected.city}" country="${expected.country}"\n` +
      `      Got:      city="${result.city}"  country="${result.country}" ${conf}\n`
    );
  }

  const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : 'N/A';
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Results: ${correct}/${total} correct  (accuracy: ${accuracy}%)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch((err) => {
  console.error('Evaluation script error:', err);
  process.exit(1);
});
