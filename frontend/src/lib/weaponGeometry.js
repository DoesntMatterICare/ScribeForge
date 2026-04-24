// ═══════════════════════════════════════════════════════════════
// GEOMETRY → PHYSICS MAPPING ENGINE
// Full implementation of Steps 0–9
// ═══════════════════════════════════════════════════════════════

const TUNE = {
  massScale:         0.01,
  reachScale:        120,
  speedBase:         600,
  damageScale:       1.0,
  knockbackScale:    0.15,
  chaosSpinMax:      720,
  specialCooldown:   8000,
  inertiaScale:      0.8,
  energyBonus:       0.2,
  parryScale:        1.0,
  symGripThreshold:  5,
  minStrokeDuration: 16,
};

// ═══════════ MATH HELPERS ═══════════

function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function perpDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function centroid(pts) {
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  return { x: sx / pts.length, y: sy / pts.length };
}

function variance(arr) {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((s, v) => s + (v - m) * (v - m), 0) / arr.length;
}

// ═══════════ STEP 0: ORIENTATION NORMALIZATION (PCA) ═══════════

function pcaRotate(pts) {
  if (pts.length < 2) return pts;
  const c = centroid(pts);
  // Covariance matrix
  let cxx = 0, cxy = 0, cyy = 0;
  for (const p of pts) {
    const dx = p.x - c.x, dy = p.y - c.y;
    cxx += dx * dx; cxy += dx * dy; cyy += dy * dy;
  }
  const n = pts.length;
  cxx /= n; cxy /= n; cyy /= n;

  // Dominant eigenvector via analytic 2x2 eigendecomposition
  const trace = cxx + cyy;
  const det = cxx * cyy - cxy * cxy;
  const disc = Math.sqrt(Math.max(0, trace * trace / 4 - det));
  const lambda1 = trace / 2 + disc; // larger eigenvalue
  let ex, ey;
  if (Math.abs(cxy) > 1e-8) {
    ex = lambda1 - cyy; ey = cxy;
  } else if (cxx >= cyy) {
    ex = 1; ey = 0;
  } else {
    ex = 0; ey = 1;
  }
  const mag = Math.hypot(ex, ey) || 1;
  ex /= mag; ey /= mag;

  // Rotate so principal axis → [1, 0]
  // rotation: cos=ex, sin=ey → new_x = ex*dx + ey*dy, new_y = -ey*dx + ex*dy
  return pts.map(p => {
    const dx = p.x - c.x, dy = p.y - c.y;
    return {
      x: ex * dx + ey * dy,
      y: -ey * dx + ex * dy,
      t: p.t, // preserve timestamp
    };
  });
}

// ═══════════ STEP 1: STROKE CAPTURE & CLEANUP ═══════════

// Sample points every ~sampleDist px along the polyline
export function resamplePath(pts, sampleDist = 8) {
  if (pts.length < 2) return [...pts];
  const out = [{ ...pts[0] }];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (d < 0.001) continue;
    const dx = (pts[i].x - pts[i - 1].x) / d;
    const dy = (pts[i].y - pts[i - 1].y) / d;
    // Interpolate timestamp
    const dt = (pts[i].t || 0) - (pts[i - 1].t || 0);
    let traveled = carry;
    while (traveled + sampleDist <= d + carry) {
      traveled += sampleDist;
      const frac = (traveled - carry) / d;
      out.push({
        x: pts[i - 1].x + dx * (traveled - carry),
        y: pts[i - 1].y + dy * (traveled - carry),
        t: (pts[i - 1].t || 0) + dt * frac,
      });
    }
    carry = d - (traveled - carry);
  }
  // Always include last point
  const last = pts[pts.length - 1];
  if (dist(out[out.length - 1], last) > 1) out.push({ ...last });
  return out;
}

// Ramer-Douglas-Peucker simplification
export function rdpSimplify(pts, eps = 6) {
  if (pts.length <= 2) return [...pts];
  let mx = 0, mi = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > mx) { mx = d; mi = i; }
  }
  if (mx > eps) {
    const l = rdpSimplify(pts.slice(0, mi + 1), eps);
    const r = rdpSimplify(pts.slice(mi), eps);
    return l.slice(0, -1).concat(r);
  }
  return [pts[0], pts[pts.length - 1]];
}

// Bounding box
function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Normalize points to fit in 200x200 unit space, centered
function normalizeToUnitSpace(pts) {
  const b = bbox(pts);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const s = Math.min(200 / (b.w || 1), 200 / (b.h || 1));
  return pts.map(p => ({
    x: (p.x - cx) * s + 100,
    y: (p.y - cy) * s + 100,
    t: p.t,
  }));
}

// Signed area (shoelace), positive for CCW
function signedArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y);
  }
  return a / 2;
}

function polyArea(pts) { return Math.abs(signedArea(pts)); }

function polyPerimeter(pts) {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    p += dist(pts[i], pts[j]);
  }
  return p;
}

// Enforce CCW winding
function enforceCCW(pts) {
  const sa = signedArea(pts);
  if (sa < 0) return [...pts].reverse();
  return pts;
}

// Self-intersection check (brute force for small polygon)
function segmentsIntersect(a1, a2, b1, b2) {
  const d1x = a2.x - a1.x, d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x, d2y = b2.y - b1.y;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return false;
  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / cross;
  const u = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / cross;
  return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
}

export function hasSelfIntersection(pts) {
  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = i + 2; j < pts.length - 1; j++) {
      if (i === 0 && j === pts.length - 2) continue; // adjacent wrap
      if (segmentsIntersect(pts[i], pts[i + 1], pts[j], pts[j + 1])) return true;
    }
  }
  return false;
}

// Open vs closed detection
function isClosed(pts) {
  if (pts.length < 3) return false;
  return dist(pts[0], pts[pts.length - 1]) < 15;
}

// Create ribbon polygon for open strokes
function createRibbonPolygon(pts, halfWidth) {
  const hw = Math.max(halfWidth, 3);
  const upper = [], lower = [];
  for (let i = 0; i < pts.length; i++) {
    let nx, ny;
    if (i === 0) {
      const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
      const m = Math.hypot(dx, dy) || 1;
      nx = -dy / m; ny = dx / m;
    } else if (i === pts.length - 1) {
      const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
      const m = Math.hypot(dx, dy) || 1;
      nx = -dy / m; ny = dx / m;
    } else {
      const dx1 = pts[i].x - pts[i - 1].x, dy1 = pts[i].y - pts[i - 1].y;
      const dx2 = pts[i + 1].x - pts[i].x, dy2 = pts[i + 1].y - pts[i].y;
      const m1 = Math.hypot(dx1, dy1) || 1, m2 = Math.hypot(dx2, dy2) || 1;
      nx = -(dy1 / m1 + dy2 / m2) / 2;
      ny = (dx1 / m1 + dx2 / m2) / 2;
      const nm = Math.hypot(nx, ny) || 1;
      nx /= nm; ny /= nm;
    }
    upper.push({ x: pts[i].x + nx * hw, y: pts[i].y + ny * hw });
    lower.unshift({ x: pts[i].x - nx * hw, y: pts[i].y - ny * hw });
  }
  return [...upper, ...lower];
}

// ═══════════ CONVEX HULL ═══════════

export function convexHull(points) {
  if (points.length <= 3) return [...points];
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0) upper.pop();
    upper.push(pts[i]);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// ═══════════ STEP 2: GRIP POINT DETECTION ═══════════

function computeGrip(pts) {
  const b = bbox(pts);
  const segCount = 10;
  const segWidth = (b.w || 1) / segCount;
  const segWidths = [];
  const segPoints = Array.from({ length: segCount }, () => []);

  for (const p of pts) {
    const si = Math.min(segCount - 1, Math.floor((p.x - b.x) / segWidth));
    segPoints[si].push(p);
  }

  for (let i = 0; i < segCount; i++) {
    const sp = segPoints[i];
    if (sp.length < 2) {
      segWidths.push(0);
    } else {
      let minY = Infinity, maxY = -Infinity;
      for (const p of sp) {
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      segWidths.push(maxY - minY);
    }
  }

  const wVar = variance(segWidths);
  const cen = centroid(pts);

  // Symmetric weapon case
  if (wVar < TUNE.symGripThreshold) {
    return {
      gripPoint: cen,
      gripEnd: 'center',
      segWidths,
      segPoints,
    };
  }

  // Asymmetric case
  const leftAvg = segWidths.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
  const rightAvg = segWidths.slice(6).reduce((a, b) => a + b, 0) / 4;
  const handlePole = leftAvg <= rightAvg ? 'left' : 'right';

  // Find thinnest segment on handle side
  const searchRange = handlePole === 'left' ? [0, 1, 2, 3] : [6, 7, 8, 9];
  let minW = Infinity, gripSeg = searchRange[0];
  for (const si of searchRange) {
    if (segWidths[si] < minW && segPoints[si].length > 0) {
      minW = segWidths[si];
      gripSeg = si;
    }
  }

  const gripPts = segPoints[gripSeg];
  const gripPoint = gripPts.length > 0 ? centroid(gripPts) : cen;

  return {
    gripPoint,
    gripEnd: handlePole,
    segWidths,
    segPoints,
  };
}

// ═══════════ STEP 3: RAW METRICS ═══════════

function countCorners(pts, threshold = 90) {
  let c = 0;
  const tr = threshold * Math.PI / 180;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], cc = pts[i + 1];
    const v1 = { x: a.x - b.x, y: a.y - b.y };
    const v2 = { x: cc.x - b.x, y: cc.y - b.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
    if (m === 0) continue;
    const ang = Math.acos(clamp(dot / m, -1, 1));
    if (ang < tr) c++;
  }
  return c;
}

function computeTipHeaviness(pts, gripPoint, segWidths, segPoints) {
  const b = bbox(pts);
  const segWidth = (b.w || 1) / 10;
  const maxDist = Math.hypot(b.w, b.h);
  let weightedSum = 0, totalWeight = 0;

  for (const p of pts) {
    const d = dist(p, gripPoint);
    const si = Math.min(9, Math.floor((p.x - b.x) / segWidth));
    const w = Math.max(1, segWidths[si]);
    weightedSum += d * w;
    totalWeight += w;
  }

  if (totalWeight === 0 || maxDist === 0) return 0.5;
  return clamp(weightedSum / (totalWeight * maxDist), 0, 1);
}

// ═══════════ STEP 4: NORMALIZE METRICS ═══════════
// ═══════════ STEP 5: DERIVE WEAPON PROPERTIES ═══════════
// ═══════════ STEP 6: DOMINANT DAMAGE TYPE ═══════════
// ═══════════ STEP 7: SPECIAL MOVE ASSIGNMENT ═══════════
// ═══════════ STEP 8: STAT BAR DISPLAY ═══════════

// All combined in the main analysis function below.

// ═══════════ MAIN ANALYSIS PIPELINE ═══════════

export function analyzeStroke(rawPoints, rawLength) {
  if (!rawPoints || rawPoints.length < 5) return null;

  // ── Step 0: PCA rotation ──
  const rotated = pcaRotate(rawPoints);

  // ── Step 1 continued: normalize to 200x200 ──
  const b0 = bbox(rotated);
  if (b0.w < 40 && b0.h < 40) return null; // reject tiny strokes (pre-normalize check)

  const unitPts = normalizeToUnitSpace(rotated);

  // Check bbox again in unit space (should always be >= 40 now due to scaling, but guard)
  const bUnit = bbox(unitPts);

  // RDP simplify in unit space
  let simplified = rdpSimplify(unitPts, 6);
  if (simplified.length < 5) {
    // If too few after simplification, use denser resampling
    simplified = unitPts.length >= 5 ? unitPts.slice(0, 40) : unitPts;
  }
  if (simplified.length > 40) {
    // Downsample to 40
    const step = simplified.length / 40;
    const downsampled = [];
    for (let i = 0; i < 40; i++) {
      downsampled.push(simplified[Math.floor(i * step)]);
    }
    simplified = downsampled;
  }
  if (simplified.length < 5) return null;

  // Winding order: enforce CCW
  const wound = enforceCCW(simplified);

  // Open vs closed
  const closed = isClosed(wound);
  const isOpenStroke = !closed;

  // ── Step 1: Velocity ──
  const firstT = rawPoints[0]?.t || 0;
  const lastT = rawPoints[rawPoints.length - 1]?.t || 0;
  const strokeDuration = Math.max(lastT - firstT, TUNE.minStrokeDuration);
  const totalRawLength = rawLength || polyPerimeter(rawPoints);
  const strokeEnergy = totalRawLength / strokeDuration;

  // ── Step 2: Grip point ──
  const grip = computeGrip(wound);
  const { gripPoint, gripEnd, segWidths, segPoints } = grip;

  // ── Step 3: Raw metrics ──
  const hull = convexHull(wound);
  const hullArea = polyArea(hull);
  const perimeter = polyPerimeter(wound);
  const strokeLength = totalRawLength;

  let area;
  let ribbonPolygon = null;
  if (isOpenStroke) {
    const avgW = perimeter > 0 ? (hullArea / perimeter) : 5;
    ribbonPolygon = createRibbonPolygon(wound, Math.max(avgW, 3));
    area = polyArea(ribbonPolygon);
  } else {
    area = polyArea(wound);
  }

  const bx = bbox(wound);
  const bbox_w = bx.w, bbox_h = bx.h;
  const aspectRatio = bbox_h > 0 ? bbox_w / bbox_h : 1;
  const elongation = Math.max(aspectRatio, 1 / (aspectRatio || 1));
  const circularity = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;
  const convexity = hullArea > 0 ? area / hullArea : 1;
  const cornerCount = countCorners(wound, 90);
  const avgStrokeWidth = strokeLength > 0 ? area / strokeLength : 0;
  const defenseCoverage = perimeter > 0
    ? (bbox_w * bbox_h) / (perimeter * perimeter) * convexity
    : 0;

  const tipHeaviness = computeTipHeaviness(wound, gripPoint, segWidths, segPoints);

  // ── Step 4: Normalize 0→1 ──
  const elongation_n = clamp(elongation, 1, 8) / 8;
  const circularity_n = clamp(circularity, 0, 1);
  const convexity_n = clamp(convexity, 0, 1);
  const area_n = clamp(area, 0, 40000) / 40000;
  const corners_n = clamp(cornerCount, 0, 10) / 10;
  const thickness_n = clamp(avgStrokeWidth, 0, 30) / 30;
  const defense_n = clamp(defenseCoverage, 0, 1);
  const energy_n = clamp(strokeEnergy, 0, 3) / 3;

  // ── Step 5: Derive weapon properties ──
  const mass = clamp(1 + (area_n * 18) + (thickness_n * 6), 1, 25);

  const inertiaRaw = mass * elongation_n * (0.4 + tipHeaviness * 0.6);
  const inertia_n = clamp(inertiaRaw, 0, 50) / 50;

  const speed = clamp(
    600 - (elongation_n * 200) - (area_n * 150) + (circularity_n * 100) - (inertia_n * 80),
    200, 700
  );

  const reach = clamp(20 + (elongation_n * 120) + (area_n * 30), 20, 150);

  const slash = clamp(
    (elongation_n * 25) * (1 - circularity_n) * convexity_n * (1 + energy_n * 0.2),
    0, 25
  );

  const blunt = clamp(
    ((circularity_n * 20) + (area_n * 15) * (1 - elongation_n * 0.5)) * (1 + energy_n * 0.15),
    0, 30
  );

  const pierce = clamp(
    (elongation_n * 30) * (1 - thickness_n) * convexity_n * (1 + energy_n * 0.1),
    0, 30
  );

  const chaos = clamp((1 - convexity_n) * (corners_n * 0.8), 0, 1);

  const aoeRadius = circularity_n > 0.7 ? clamp(circularity_n * 60, 0, 60) : 0;

  const blockBreak = clamp((mass / 25) * 0.6 + (blunt / 30) * 0.4, 0, 1);

  const parry = clamp((defense_n * 0.7) + (convexity_n * 0.3), 0, 1);

  const swingArcEasing = tipHeaviness > 0.6 ? 'easeInCubic' : 'easeOutQuad';

  // ── Step 6: Dominant damage type ──
  let dominantType;
  if (slash < 5 && blunt < 5 && pierce < 5) {
    dominantType = 'raw';
  } else if (slash >= blunt && slash >= pierce) {
    dominantType = 'slash';
  } else if (blunt >= slash && blunt >= pierce) {
    dominantType = 'blunt';
  } else {
    dominantType = 'pierce';
  }

  // ── Step 7: Special move ──
  let special;
  if (elongation_n > 0.7 && pierce > slash) {
    special = { name: 'LUNGE', type: 'lunge', desc: 'Dash forward, pierce through block' };
  } else if (elongation_n > 0.7 && slash >= pierce) {
    special = { name: 'WHIRLWIND', type: 'whirlwind', desc: 'Spin 360°, hits all in radius' };
  } else if (circularity_n > 0.7) {
    special = { name: 'SHOCKWAVE', type: 'shockwave', desc: 'AOE ground slam, stuns 800ms' };
  } else if (mass > 15) {
    special = { name: 'CRUSH', type: 'crush', desc: 'Unblockable overhead smash' };
  } else if (chaos > 0.6) {
    special = { name: 'RICOCHET', type: 'ricochet', desc: 'Bounces 2–3 times off walls' };
  } else if (corners_n > 0.7) {
    special = { name: 'SERRATE', type: 'serrate', desc: 'Rapid 5-hit combo, applies bleed' };
  } else {
    special = { name: 'OVERPOWER', type: 'overpower', desc: 'Double damage single hit' };
  }

  // ── Step 8: Stat bars ──
  const statBars = {
    power: clamp((blunt + slash + pierce) / 85, 0, 1),
    speed: clamp(1 - ((speed - 200) / 500), 0, 1),
    reach: clamp((reach - 20) / 130, 0, 1),
    parry: clamp(parry, 0, 1),
    chaos: clamp(chaos, 0, 1),
  };

  // ── Grip offset for hitbox attachment ──
  const shapeCentroid = centroid(wound);
  const gripOffset = {
    x: gripPoint.x - shapeCentroid.x,
    y: gripPoint.y - shapeCentroid.y,
  };

  return {
    // Raw geometry
    vertices: wound,
    hull,
    ribbonPolygon,
    isOpenStroke,
    isClosed: closed,
    allPoints: unitPts,

    // Grip
    gripPoint,
    gripEnd,
    gripOffset,

    // Raw metrics
    rawMetrics: {
      area, perimeter, bbox_w, bbox_h, aspectRatio, elongation,
      circularity, convexity, cornerCount, strokeLength, avgStrokeWidth,
      defenseCoverage, tipHeaviness,
    },

    // Normalized metrics
    normalized: {
      elongation_n, circularity_n, convexity_n, area_n,
      corners_n, thickness_n, defense_n, energy_n,
    },

    // Physics properties
    physics: {
      mass, inertia: inertiaRaw, inertia_n, speed, reach,
      slash, blunt, pierce,
      chaos, aoeRadius, blockBreak, parry,
      swingArcEasing,
    },

    // Derived
    dominantType,
    special,
    statBars,

    // Stroke metadata
    strokeEnergy,
    strokeDuration,
  };
}

// ═══════════ STEP 9: HITBOX / VERTEX HELPERS ═══════════

// Normalize vertices to center around origin, scaled to fit in a box
export function normalizeVertices(verts, size = 40) {
  if (!verts || verts.length < 2) return [];
  const b = bbox(verts);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const scale = Math.min(size / (b.w || 1), size / (b.h || 1));
  return verts.map(v => ({ x: (v.x - cx) * scale, y: (v.y - cy) * scale }));
}

// ═══════════ LEGACY COMPAT WRAPPERS ═══════════
// These maintain backward compatibility with old code paths

export function analyzeGeometry(allPts) {
  if (allPts.length < 3) return null;
  const hull = convexHull(allPts);
  const area = Math.max(1, polyArea(hull));
  const perim = Math.max(1, polyPerimeter(hull));
  const circularity = Math.min(1, (4 * Math.PI * area) / (perim * perim));
  const b = bbox(allPts);
  const aspectRatio = b.h > 0 ? b.w / b.h : 1;
  const elongation = Math.max(aspectRatio, 1 / (aspectRatio || 1));
  const sharpCount = countCorners(allPts, 45);
  return { area, perimeter: perim, circularity, elongation, aspectRatio, sharpAngles: sharpCount, hull, bbox: b };
}

export function mapToPhysics(geo) {
  if (!geo) return {
    mass: 5, speed: 0.5, reach: 0.5, power: 0.5,
    slash: 4, blunt: 3, pierce: 0,
    parry: 0.3, chaos: 0, blockBreak: 0.2,
    swingArcEasing: 'easeOutQuad',
    slashDamage: 4, bluntDamage: 3, pierceDamage: 0,
    restitution: 0.5,
  };
  // Compute using simplified old pipeline
  const mass = Math.max(1, geo.area * 0.01);
  const slashDmg = geo.elongation * 2;
  const bluntDmg = geo.area * 0.005;
  const pierceDmg = (geo.elongation > 4 && geo.area < 2000) ? geo.elongation * 3 : 0;
  const speed = Math.max(0.15, Math.min(1, 1 - mass * 0.015));
  const power = Math.min(1, (slashDmg + bluntDmg + pierceDmg) * 0.04);
  const reach = Math.min(1, Math.max(0.1, geo.elongation * 0.18));
  return {
    mass, speed, power, reach,
    slash: slashDmg, blunt: bluntDmg, pierce: pierceDmg,
    slashDamage: slashDmg, bluntDamage: bluntDmg, pierceDamage: pierceDmg,
    parry: 0.3, chaos: 0, blockBreak: 0.2,
    restitution: Math.min(1, geo.circularity),
    swingArcEasing: 'easeOutQuad',
  };
}

export function getSpecialMove(geo) {
  if (!geo) return { name: 'OVERPOWER', type: 'overpower', desc: 'Double damage single hit' };
  const mass = geo.area * 0.01;
  const pierce = (geo.elongation > 4 && geo.area < 2000) ? geo.elongation * 3 : 0;
  if (pierce > 8) return { name: 'LUNGE', type: 'lunge', desc: 'Dash forward, pierce through block' };
  if (geo.elongation > 3.5) return { name: 'WHIRLWIND', type: 'whirlwind', desc: 'Spin 360°, hits all in radius' };
  if (geo.circularity > 0.65) return { name: 'SHOCKWAVE', type: 'shockwave', desc: 'AOE ground slam, stuns 800ms' };
  if (mass > 12) return { name: 'CRUSH', type: 'crush', desc: 'Unblockable overhead smash' };
  return { name: 'OVERPOWER', type: 'overpower', desc: 'Double damage single hit' };
}
