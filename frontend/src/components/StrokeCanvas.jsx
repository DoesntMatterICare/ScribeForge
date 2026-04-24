import { useRef, useState, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import { analyzeStroke, hasSelfIntersection, resamplePath, rdpSimplify } from '../lib/weaponGeometry';

const StrokeCanvas = forwardRef(function StrokeCanvas({ onAnalysis }, ref) {
  const canvasRef = useRef(null);
  const [stroke, setStroke] = useState(null); // single stroke (array of points)
  const [status, setStatus] = useState('idle'); // idle | drawing | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const drawing = useRef(false);
  const cur = useRef([]);
  const rawLength = useRef(0);
  const analysisCache = useRef(null);

  const analyze = useCallback((pts) => {
    if (!pts || pts.length < 5) {
      analysisCache.current = null;
      onAnalysis?.(null);
      return null;
    }
    // Resample at 8px
    const resampled = resamplePath(pts, 8);
    // Raw length for energy
    let totalLen = 0;
    for (let i = 1; i < pts.length; i++) {
      totalLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }

    const result = analyzeStroke(resampled, totalLen);
    analysisCache.current = result;
    onAnalysis?.(result);
    return result;
  }, [onAnalysis]);

  useImperativeHandle(ref, () => ({
    getAnalysis: () => {
      if (analysisCache.current) return analysisCache.current;
      return stroke ? analyze(stroke) : null;
    },
    toDataURL: () => canvasRef.current?.toDataURL('image/png'),
    clear: () => {
      setStroke(null);
      setStatus('idle');
      setErrorMsg('');
      analysisCache.current = null;
      cur.current = [];
      rawLength.current = 0;
      redraw(null);
      onAnalysis?.(null);
    },
    getStrokes: () => stroke ? [stroke] : [],
    getStroke: () => stroke,
  }));

  const getPos = useCallback((e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    const cw = c.width, ch = c.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - r.left) * cw / r.width,
      y: (clientY - r.top) * ch / r.height,
      t: performance.now(),
    };
  }, []);

  const redraw = useCallback((pts, gripPoint = null) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const w = canvasRef.current.width, h = canvasRef.current.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = 'rgba(100,116,180,0.06)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    if (!pts || pts.length < 2) return;

    // Shadow
    ctx.strokeStyle = 'rgba(96,165,250,0.25)';
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0].x + 1, pts[0].y + 1);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x + 1, pts[i].y + 1);
    ctx.stroke();

    // Main ink
    ctx.strokeStyle = '#e8eaf6';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // Draw grip point indicator if available
    if (gripPoint) {
      // Scale grip from 200x200 unit space to canvas space
      const b = { x: Infinity, y: Infinity, w: 0, h: 0 };
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of pts) {
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
      }
      // gripPoint is in canvas coords already when we display stored stroke
      ctx.fillStyle = 'rgba(251,191,36,0.6)';
      ctx.beginPath();
      ctx.arc(gripPoint.x, gripPoint.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(251,191,36,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(gripPoint.x, gripPoint.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, []);

  // Redraw when stroke changes (e.g., after clear)
  useEffect(() => {
    if (status === 'idle' || !stroke) {
      redraw(null);
    }
  }, [status, stroke, redraw]);

  const onDown = useCallback((e) => {
    e.preventDefault();
    // If we already have a confirmed stroke, ignore
    if (status === 'done') return;
    // Start new stroke (reset if they had a previous unconfirmed one)
    drawing.current = true;
    rawLength.current = 0;
    const pos = getPos(e);
    cur.current = [pos];
    setStatus('drawing');
    setErrorMsg('');
  }, [getPos, status]);

  const onMove = useCallback((e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const pos = getPos(e);
    const prev = cur.current[cur.current.length - 1];
    const d = Math.hypot(pos.x - prev.x, pos.y - prev.y);
    // Only add if moved enough
    if (d > 2) {
      rawLength.current += d;
      cur.current.push(pos);
      redraw(cur.current);
    }
  }, [getPos, redraw]);

  const onUp = useCallback((e) => {
    if (e) e.preventDefault();
    if (!drawing.current) return;
    drawing.current = false;

    const pts = cur.current;
    if (pts.length < 5) {
      setErrorMsg('Draw a longer stroke');
      setStatus('idle');
      cur.current = [];
      redraw(null);
      return;
    }

    // Check bounding box
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    if ((x1 - x0) < 40 && (y1 - y0) < 40) {
      setErrorMsg('Too small — draw bigger');
      setStatus('idle');
      cur.current = [];
      redraw(null);
      return;
    }

    // Check self-intersection on simplified path
    const simplified = rdpSimplify(pts, 4);
    if (hasSelfIntersection(simplified)) {
      setErrorMsg('Clean stroke only — no crossing');
      setStatus('idle');
      cur.current = [];
      redraw(null);
      return;
    }

    // Stroke is valid — set it and analyze
    setStroke(pts);
    setStatus('done');
    setErrorMsg('');
    redraw(pts);
    analyze(pts);
  }, [redraw, analyze]);

  const handleConfirm = useCallback(() => {
    // Already confirmed via onUp
  }, []);

  const handleRedraw = useCallback(() => {
    setStroke(null);
    setStatus('idle');
    setErrorMsg('');
    analysisCache.current = null;
    cur.current = [];
    rawLength.current = 0;
    redraw(null);
    onAnalysis?.(null);
  }, [redraw, onAnalysis]);

  return (
    <div className="stroke-canvas-wrapper" data-testid="stroke-canvas-wrapper">
      <canvas
        ref={canvasRef}
        width={400} height={400}
        className="stroke-canvas"
        data-testid="stroke-canvas"
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={onUp}
      />
      {errorMsg && (
        <p className="stroke-error" data-testid="stroke-error">{errorMsg}</p>
      )}
      {status === 'done' && (
        <button className="redraw-btn tool-btn" onClick={handleRedraw} data-testid="redraw-btn">
          Redraw
        </button>
      )}
      {status === 'idle' && !errorMsg && (
        <p className="stroke-hint">Draw one continuous stroke — shape becomes your weapon</p>
      )}
    </div>
  );
});
export default StrokeCanvas;
