import { useRef, useState, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import { analyzeArmor, getArmorRegions } from '../lib/armorGeometry';

const CANVAS_W = 300;
const CANVAS_H = 400;
const BRUSH_SIZE = 18;

const ArmorCanvas = forwardRef(function ArmorCanvas({ onAnalysis }, ref) {
  const canvasRef = useRef(null);
  const [hasDrawing, setHasDrawing] = useState(false);
  const drawing = useRef(false);
  const analysisCache = useRef(null);
  const lastPoint = useRef(null);

  // Draw the template guides (head circle + torso rect)
  const drawTemplate = useCallback((ctx) => {
    const regions = getArmorRegions(CANVAS_W, CANVAS_H);

    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';

    // Head circle
    ctx.beginPath();
    ctx.arc(regions.head.cx, regions.head.cy, regions.head.r, 0, Math.PI * 2);
    ctx.stroke();

    // Torso rectangle with rounded corners
    const t = regions.torso;
    ctx.beginPath();
    ctx.roundRect(t.x, t.y, t.w, t.h, 8);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();

    // Labels
    ctx.save();
    ctx.font = '11px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('HELMET', regions.head.cx, regions.head.cy + regions.head.r + 16);
    ctx.fillText('BODY ARMOR', t.x + t.w / 2, t.y + t.h + 18);
    ctx.restore();
  }, []);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawTemplate(ctx);
  }, [drawTemplate]);

  const analyze = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const result = analyzeArmor(canvas);
    analysisCache.current = result;
    onAnalysis?.(result);
    return result;
  }, [onAnalysis]);

  useImperativeHandle(ref, () => ({
    getAnalysis: () => analysisCache.current || analyze(),
    toDataURL: () => canvasRef.current?.toDataURL('image/png'),
    clear: () => {
      setHasDrawing(false);
      analysisCache.current = null;
      lastPoint.current = null;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        drawTemplate(ctx);
      }
      onAnalysis?.(null);
    },
    getCanvas: () => canvasRef.current,
  }));

  // Drawing handlers
  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e) => {
    e.preventDefault();
    drawing.current = true;
    const pos = getPos(e);
    lastPoint.current = pos;
    const ctx = canvasRef.current.getContext('2d');
    ctx.fillStyle = '#c8d6e5';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, BRUSH_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const moveDraw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = '#c8d6e5';
    ctx.lineWidth = BRUSH_SIZE;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (lastPoint.current) {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    lastPoint.current = pos;
  };

  const endDraw = () => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPoint.current = null;
    setHasDrawing(true);
    // Auto-analyze after drawing stops
    setTimeout(analyze, 50);
  };

  return (
    <div className="armor-canvas-wrap" data-testid="armor-canvas">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="armor-canvas"
        onMouseDown={startDraw}
        onMouseMove={moveDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={moveDraw}
        onTouchEnd={endDraw}
      />
      {!hasDrawing && (
        <p className="armor-hint">Fill inside the regions to create armor</p>
      )}
    </div>
  );
});

export default ArmorCanvas;
