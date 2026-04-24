import { useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';

const SIZE = 64;

const PixelCanvas = forwardRef(function PixelCanvas({ color = '#FFFFFF', brushSize = 1, isErasing = false }, ref) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [showGrid, setShowGrid] = useState(true);

  useImperativeHandle(ref, () => ({
    toDataURL: () => canvasRef.current?.toDataURL('image/png'),
    clear: () => {
      const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });
      if (ctx) ctx.clearRect(0, 0, SIZE, SIZE);
    },
    getCanvas: () => canvasRef.current,
  }));

  const getPixel = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [
      Math.floor((e.clientX - rect.left) * SIZE / rect.width),
      Math.floor((e.clientY - rect.top) * SIZE / rect.height),
    ];
  }, []);

  const paint = useCallback((e) => {
    const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const [px, py] = getPixel(e);
    if (px < 0 || py < 0 || px >= SIZE || py >= SIZE) return;
    if (isErasing) {
      ctx.clearRect(px, py, brushSize, brushSize);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(px, py, brushSize, brushSize);
    }
  }, [color, brushSize, isErasing, getPixel]);

  const onDown = useCallback((e) => { drawing.current = true; paint(e); }, [paint]);
  const onMove = useCallback((e) => { if (drawing.current) paint(e); }, [paint]);
  const onUp = useCallback(() => { drawing.current = false; }, []);

  return (
    <div className="pixel-canvas-wrapper" data-testid="pixel-canvas-wrapper">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className={`pixel-canvas ${showGrid ? 'show-grid' : ''}`}
        data-testid="pixel-canvas"
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
      />
      <button
        className="grid-toggle"
        data-testid="grid-toggle-btn"
        onClick={() => setShowGrid(s => !s)}
      >
        {showGrid ? 'HIDE GRID' : 'SHOW GRID'}
      </button>
    </div>
  );
});

export default PixelCanvas;
