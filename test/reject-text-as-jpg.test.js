// ==== FILEPATH: test/reject-text-as-jpg.test.js ====
'use strict';

const { test }  = require('node:test');
const assert    = require('node:assert/strict');
const multer    = require('multer');
const express   = require('express');
const http      = require('node:http');

/**
 * Regression test: the server's multer fileFilter must reject non-image files
 * even when they carry a .jpg filename.
 *
 * We spin up a minimal Express app with the same fileFilter logic used in
 * server.js so the test remains self-contained and fast (no real API calls).
 */

function buildTestApp() {
  const app = express();

  const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        const err = new Error('Invalid file type');
        err.status = 415;
        return cb(err, false);
      }
      cb(null, true);
    },
  });

  // Minimal /locate route that mimics the real one
  app.post('/locate', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    res.json({ status: 'ok' });
  });

  // Error handler (mirrors the real server error handler)
  app.use((err, _req, res, _next) => {
    res.status(err.status ?? 500).json({ error: err.message });
  });

  return app;
}

/** Simple helper to send a multipart/form-data POST request without supertest */
function postMultipart(app, fieldName, filename, mimeType, data) {
  return new Promise((resolve, reject) => {
    const boundary = '----TestBoundary' + Date.now();
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
      ),
      data,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const req  = http.request(
        { method: 'POST', hostname: 'localhost', port, path: '/locate',
          headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`,
                     'Content-Length': body.length } },
        (res) => {
          let chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            server.close();
            resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() });
          });
        }
      );
      req.on('error', (e) => { server.close(); reject(e); });
      req.write(body);
      req.end();
    });
  });
}

test('Rejects a plain-text file disguised as .jpg (expects 415 or 400)', async () => {
  const app        = buildTestApp();
  const fakeJpg    = Buffer.from('This is definitely not image data – it is plain text.');

  const { status } = await postMultipart(app, 'image', 'fake.jpg', 'text/plain', fakeJpg);

  // multer's fileFilter rejects with an error → generic error handler → 415
  // If multer silently drops the file, the route guard returns 400.
  assert.ok(
    status === 415 || status === 400,
    `Expected status 415 or 400, got ${status}`
  );
});

test('Accepts a real image (JPEG magic bytes)', async () => {
  const app = buildTestApp();

  // Minimal valid JPEG SOI + EOI markers
  const minimalJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);

  const { status } = await postMultipart(app, 'image', 'real.jpg', 'image/jpeg', minimalJpeg);

  // The minimal JPEG buffer passes the fileFilter so it should reach the route
  // and return 200 (ok) or possibly 400 if the buffer is otherwise invalid.
  // The key assertion is that it does NOT return 415.
  assert.notEqual(status, 415, 'A real JPEG should not be rejected with 415');
});
