import { useEffect, useRef } from 'react';
import { MobiusRenderer } from './MobiusRenderer.js';
import { sceneSize } from './layout.js';

export function MobiusScene({ telemetry, layout }) {
  const canvas = useRef(null);
  const worldHeight = sceneSize({ ...layout, mainWidth: layout.worldWidth, mainHeight: layout.worldHeight }).height;
  const visibleHeight = Math.max(1, Math.min(layout.height, worldHeight - layout.y));
  useEffect(() => {
    const renderer = new MobiusRenderer(canvas.current, telemetry, { ...layout, sceneHeight: worldHeight });
    return () => renderer.destroy();
  }, [telemetry, layout, worldHeight]);
  return <canvas ref={canvas} className="dispatch-scene" style={{ left: layout.x, top: layout.y,
    width: layout.width, height: visibleHeight }} aria-label="Möbius dispatch ring with synchronized bidirectional streams across displays" role="img" />;
}
