import { useEffect, useRef } from 'react';
import { DispatchScene } from './scene/DispatchScene.js';
import { MobiusScene } from './screensaver/MobiusScene.jsx';

export function Scene({ telemetry, layout }) {
  return layout?.count > 1 ? <MobiusScene telemetry={telemetry} layout={layout} /> : <OriginalScene telemetry={telemetry} />;
}

function OriginalScene({ telemetry }) {
  const canvas = useRef(null);
  useEffect(() => {
    const scene = new DispatchScene(canvas.current, telemetry);
    return () => scene.destroy();
  }, [telemetry]);
  return <canvas ref={canvas} className="dispatch-scene" aria-label="Live input, tools and output flow. The core coasts as traffic subsides." role="img" />;
}
