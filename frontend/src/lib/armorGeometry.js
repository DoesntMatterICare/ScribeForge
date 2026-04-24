// ═══════════════════════════════════════════════════════════
// Armor Geometry Analysis
// Analyzes drawn fill density in head/torso regions to
// determine helmet and body armor strength
// ═══════════════════════════════════════════════════════════

// Region definitions (percentage of 300x400 canvas)
const HEAD_REGION = { cx: 0.5, cy: 0.15, r: 0.13 };          // circle
const TORSO_REGION = { x: 0.25, y: 0.32, w: 0.50, h: 0.35 }; // rectangle

/**
 * Check if pixel at (px,py) is drawn (non-transparent, non-white)
 */
function isDrawn(pixels, w, px, py) {
  const idx = (py * w + px) * 4;
  const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2], a = pixels[idx + 3];
  // Consider drawn if alpha > 30 and not near-white
  return a > 128 && (r + g + b) < 700;
}

/**
 * Count fill ratio in a circular region
 */
function circleFill(pixels, canvasW, canvasH, region) {
  const cx = Math.round(region.cx * canvasW);
  const cy = Math.round(region.cy * canvasH);
  const r = Math.round(region.r * Math.min(canvasW, canvasH));
  let total = 0, filled = 0;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || x >= canvasW || y < 0 || y >= canvasH) continue;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        total++;
        if (isDrawn(pixels, canvasW, x, y)) filled++;
      }
    }
  }
  return total > 0 ? filled / total : 0;
}

/**
 * Count fill ratio in a rectangular region
 */
function rectFill(pixels, canvasW, canvasH, region) {
  const x0 = Math.round(region.x * canvasW);
  const y0 = Math.round(region.y * canvasH);
  const w = Math.round(region.w * canvasW);
  const h = Math.round(region.h * canvasH);
  let total = 0, filled = 0;
  for (let y = y0; y < y0 + h && y < canvasH; y++) {
    for (let x = x0; x < x0 + w && x < canvasW; x++) {
      if (x < 0 || x >= canvasW) continue;
      total++;
      if (isDrawn(pixels, canvasW, x, y)) filled++;
    }
  }
  return total > 0 ? filled / total : 0;
}

/**
 * Compute armor stats from fill ratio
 * Fill < 0.05 → no armor
 * Fill 0.05-0.30 → Light
 * Fill 0.30-0.65 → Medium
 * Fill 0.65-1.00 → Heavy
 */
function computeStats(fillRatio, type) {
  if (fillRatio < 0.05) {
    return { fillRatio, tier: 'none', reduction: 0, durability: 0, maxDurability: 0 };
  }

  // Clamp to usable range
  const t = Math.min(fillRatio, 1.0);

  let tier, reduction, durability;
  if (t < 0.30) {
    tier = 'light';
    const p = (t - 0.05) / 0.25; // 0-1 within light range
    reduction = 0.05 + p * 0.10;  // 5-15%
    durability = type === 'helmet' ? 30 + p * 30 : 40 + p * 40; // 30-60 / 40-80
  } else if (t < 0.65) {
    tier = 'medium';
    const p = (t - 0.30) / 0.35;
    reduction = 0.15 + p * 0.15;  // 15-30%
    durability = type === 'helmet' ? 60 + p * 50 : 80 + p * 60; // 60-110 / 80-140
  } else {
    tier = 'heavy';
    const p = (t - 0.65) / 0.35;
    reduction = 0.30 + p * 0.20;  // 30-50%
    durability = type === 'helmet' ? 110 + p * 60 : 140 + p * 80; // 110-170 / 140-220
  }

  return {
    fillRatio: Math.round(t * 100) / 100,
    tier,
    reduction: Math.round(reduction * 100) / 100,
    durability: Math.round(durability),
    maxDurability: Math.round(durability),
  };
}

/**
 * Main analysis function — takes a canvas element, returns armor data
 */
export function analyzeArmor(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;

  const headFill = circleFill(pixels, w, h, HEAD_REGION);
  const torsoFill = rectFill(pixels, w, h, TORSO_REGION);

  const helmet = computeStats(headFill, 'helmet');
  const body = computeStats(torsoFill, 'body');

  // Combined reduction (weighted: 30% helmet, 70% body)
  const totalReduction = helmet.reduction * 0.3 + body.reduction * 0.7;

  return {
    helmet,
    body,
    totalReduction: Math.round(totalReduction * 100) / 100,
    hasArmor: helmet.tier !== 'none' || body.tier !== 'none',
  };
}

/**
 * Returns the region definitions for drawing guides on the canvas
 */
export function getArmorRegions(canvasW, canvasH) {
  return {
    head: {
      cx: HEAD_REGION.cx * canvasW,
      cy: HEAD_REGION.cy * canvasH,
      r: HEAD_REGION.r * Math.min(canvasW, canvasH),
    },
    torso: {
      x: TORSO_REGION.x * canvasW,
      y: TORSO_REGION.y * canvasH,
      w: TORSO_REGION.w * canvasW,
      h: TORSO_REGION.h * canvasH,
    },
  };
}
