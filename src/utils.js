// src/utils.js — Shared helpers: file validation, MIME detection, HTML escaping
// Usage: validateImageType(buffer, originalName) → { ok, mimeType, error }
//        escapeHtml(str) → string

const config = require('./config');

const MAGIC_BYTES = {
  'image/jpeg': [
    [0xff, 0xd8, 0xff],
  ],
  'image/png': [
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  ],
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46], // RIFF
  ],
};

function checkMagicBytes(buffer, mimeType) {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return false;
  for (const sig of signatures) {
    if (buffer.length < sig.length) return false;
    let match = true;
    for (let i = 0; i < sig.length; i++) {
      if (buffer[i] !== sig[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

function checkWebp(buffer) {
  // RIFF....WEBP
  if (buffer.length < 12) return false;
  if (buffer[0] !== 0x52 || buffer[1] !== 0x49 || buffer[2] !== 0x46 || buffer[3] !== 0x46) return false;
  if (buffer[8] !== 0x57 || buffer[9] !== 0x45 || buffer[10] !== 0x42 || buffer[11] !== 0x50) return false;
  return true;
}

/**
 * Validate the real file type by magic bytes, not just extension.
 * @param {Buffer} buffer
 * @param {string} originalName
 * @returns {{ ok: boolean, mimeType?: string, error?: string }}
 */
function validateImageType(buffer, originalName) {
  if (!buffer || buffer.length === 0) {
    return { ok: false, error: 'Empty file' };
  }

  // Check each allowed type
  for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
    if (mimeType === 'image/webp') {
      if (checkWebp(buffer)) {
        return { ok: true, mimeType };
      }
    } else if (checkMagicBytes(buffer, mimeType)) {
      return { ok: true, mimeType };
    }
  }

  return { ok: false, error: `Unsupported file type. Allowed: ${config.ALLOWED_IMAGE_TYPES}` };
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = { validateImageType, escapeHtml };