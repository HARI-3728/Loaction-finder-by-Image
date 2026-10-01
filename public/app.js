// public/app.js — Frontend logic for Image Location Finder

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const previewRow = document.getElementById('preview-row');
const preview = document.getElementById('preview');
const fileNameEl = document.getElementById('file-name');
const btnFind = document.getElementById('btn-find');
const clientError = document.getElementById('client-error');

const uploadState = document.getElementById('upload-state');
const loadingState = document.getElementById('loading-state');
const resultState = document.getElementById('result-state');
const undetState = document.getElementById('undet-state');
const errorState = document.getElementById('error-state');

let selectedFile = null;

// --- Upload interaction ---
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.style.borderColor = 'var(--accent)';
});
dropzone.addEventListener('dragleave', () => {
  dropzone.style.borderColor = '';
});
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  clientError.textContent = '';
  // Client-side validation
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    clientError.textContent = 'Unsupported file type. Use JPEG, PNG, or WebP.';
    selectedFile = null;
    btnFind.disabled = true;
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    clientError.textContent = 'File too large. Max 10 MB.';
    selectedFile = null;
    btnFind.disabled = true;
    return;
  }
  selectedFile = file;
  // Preview
  const url = URL.createObjectURL(file);
  preview.src = url;
  previewRow.hidden = false;
  fileNameEl.textContent = file.name;
  btnFind.disabled = false;
}

// --- Find location ---
btnFind.addEventListener('click', async () => {
  if (!selectedFile) return;
  setUI('loading');
  const formData = new FormData();
  formData.append('image', selectedFile);

  try {
    const resp = await fetch('/locate', { method: 'POST', body: formData });
    const data = await resp.json();

    if (resp.status === 400) { setUI('error', data.error || 'No file uploaded.'); return; }
    if (resp.status === 413) { setUI('error', 'File too large.'); return; }
    if (resp.status === 415) { setUI('error', data.error || 'Unsupported file type.'); return; }
    if (resp.status === 502) { setUI('error', 'Upstream failure. Please retry.'); return; }
    if (!resp.ok) { setUI('error', data.error || 'Unexpected error.'); return; }

    if (data.status === 'ok') {
      renderResult(data);
    } else if (data.status === 'undetermined') {
      renderUndetermined(data);
    } else {
      setUI('error', 'Unknown response from server.');
    }
  } catch (err) {
    setUI('error', 'Network error. Check your connection and retry.');
  }
});

// --- UI state helpers ---
function setUI(state, msg) {
  uploadState.hidden = true;
  loadingState.hidden = true;
  resultState.hidden = true;
  undetState.hidden = true;
  errorState.hidden = true;

  if (state === 'upload') {
    uploadState.hidden = false;
    btnFind.disabled = !selectedFile;
  } else if (state === 'loading') {
    loadingState.hidden = false;
  } else if (state === 'result') {
    resultState.hidden = false;
  } else if (state === 'undetermined') {
    undetState.hidden = false;
  } else if (state === 'error') {
    errorState.hidden = false;
    document.getElementById('error-msg').textContent = msg || 'Something went wrong.';
  }
}

// --- Render results ---
function renderResult(d) {
  const thumb = resultState.querySelector('.result-thumb') || resultState.querySelector('#result-thumb') || preview.cloneNode(false);
  // Reuse preview image
  const img = document.createElement('img');
  img.id = 'result-thumb';
  img.className = 'result-thumb';
  img.alt = '';
  img.src = preview.src;
  const header = resultState.querySelector('.result-header');
  if (header) header.replaceChildren(img, fileNameEl.cloneNode(true));
  else {
    const rh = document.createElement('div');
    rh.className = 'result-header';
    rh.appendChild(img);
    const fn = document.createElement('span');
    fn.id = 'result-fname'; fn.className = 'file-name'; fn.textContent = selectedFile.name;
    rh.appendChild(fn);
    resultState.insertBefore(rh, resultState.firstChild);
  }

  document.getElementById('confidence-badge').textContent = 'Confidence: ' + Math.round(d.confidence * 100) + '%';
  setTile('t-country', d.country);
  setTile('t-state', d.state);
  setTile('t-city', d.city);
  setTile('t-place', d.place_name);

  const cluesLine = document.getElementById('clues-line');
  cluesLine.textContent = d.clues && d.clues.length ? 'Clues: ' + d.clues.join(', ') : '';

  const btnMaps = document.getElementById('btn-maps');
  btnMaps.href = d.maps_url || '#';
  btnMaps.style.display = d.maps_url ? '' : 'none';

  setUI('result');
}

function setTile(id, value) {
  const el = document.getElementById(id);
  el.textContent = value || 'Not identified';
}

function renderUndetermined(d) {
  // Set thumbnail from preview
  const thumb = document.createElement('img');
  thumb.className = 'result-thumb'; thumb.alt = ''; thumb.src = preview.src;
  const header = undetState.querySelector('.result-header');
  if (!header) {
    const rh = document.createElement('div'); rh.className = 'result-header';
    undetState.insertBefore(rh, undetState.firstChild);
  } else {
    header.replaceChildren(thumb);
  }
  const fn = document.createElement('span'); fn.id = 'undet-fname'; fn.className = 'file-name'; fn.textContent = selectedFile.name;
  const existingFn = undetState.querySelector('.file-name');
  if (existingFn) existingFn.replaceWith(fn); else undetState.querySelector('.result-header').appendChild(fn);

  document.getElementById('undet-clues').textContent = d.clues && d.clues.length ? 'Clues: ' + d.clues.join(', ') : '';
  setUI('undetermined');
}

// --- Retry / reset ---
document.getElementById('btn-retry')?.addEventListener('click', resetPage);
document.getElementById('btn-undet-retry')?.addEventListener('click', resetPage);
document.getElementById('btn-error-retry')?.addEventListener('click', resetPage);

function resetPage() {
  selectedFile = null;
  preview.src = '';
  previewRow.hidden = true;
  fileInput.value = '';
  btnFind.disabled = true;
  clientError.textContent = '';
  setUI('upload');
}