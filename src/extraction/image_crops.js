const sharp = require('sharp');

/**
 * Generate a set of crops from the original image.
 * Returns an array of buffers (original + up to 5 crops).
 */
async function getCrops(buffer) {
  const image = sharp(buffer);

  // Original (full-size) – keep for the primary model
  const full = await image.clone().raw().toBuffer();

  // Define a simple 3×3 grid (top, centre, bottom) plus side crops
  const { width, height } = await image.metadata();
  const crops = [];

  // Helper to extract a rectangular region
  const extract = async (x, y, w, h) => {
    return await image
      .clone()
      .extract({ left: x, top: y, width, height })
      .toBuffer();
  }

  // 1. Top half
  if (height > 1) {
    crops.push(await extract(0, 0, width, Math.floor(height / 2)));
  }
  // 2. Centre
  const centreH = Math.floor(height / 2);
  if (centreH > 0) {
    crops.push(await extract(0, centreH, width, Math.ceil(height / 2)));
  }
  // 3. Bottom half
  if (height > centreH) {
    crops.push(await extract(0, centreH, width, height - centreH));
  }
  // 4. Left third
  const thirdW = Math.floor(width / 3);
  if (thirdW > 0) {
    crops.push(await extract(0, 0, thirdW, height));
  }
  // 5. Right third
  if (width > centreH) {
    crops.push(await extract(width - thirdW, 0, thirdW, height));
  }

  // Return original + up to 5 crops (you can prune later if you want)
  return [full, ...crops];
}

module.exports = { getCrops };