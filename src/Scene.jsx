import { useEffect, useRef } from 'react';
import { DispatchScene } from './scene/DispatchScene.js';

export function Scene({ telemetry }) {
  const canvas = useRef(null);
  useEffect(() => {
    const scene = new DispatchScene(canvas.current, telemetry);
    return () => scene.destroy();
  }, [telemetry]);
  return <canvas ref={canvas} className="dispatch-scene" aria-label="实时输入、工具调用与输出流向。流量消退后核心缓慢转动。" role="img" />;
}
