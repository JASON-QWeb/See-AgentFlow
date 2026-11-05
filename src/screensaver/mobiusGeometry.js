import { bezier, hash } from '../scene/geometry.js';
import { rgb } from '../themes.js';

export const packets = Array.from({ length: 720 }, (_, i) => ({
  side: i % 2 ? 1 : -1, lane: hash(`mobius:lane:${i}`),
  phase: hash(`mobius:phase:${i}`), speed: 5 + i % 7,
  reverse: i % 9 === 0,
}));

// Integer laps per shared minute keep independent display processes in phase, including at wraparound.
export function packetProgress(packet, milliseconds) {
  return (((milliseconds % 120000) / 120000) * packet.speed + packet.phase) % 1;
}

export function flowPoint(packet, progress, width, height) {
  const angle = (packet.lane - .5) * Math.PI / 2;
  const y = height * (.52 + .255 * Math.sin(angle * 2));
  const fromX = width * .5 + packet.side * width * .265 * Math.cos(angle);
  const toX = packet.side < 0 ? -80 : width + 80;
  const targetY = height * (.52 + (packet.lane - .5) * 1.08);
  return [bezier(fromX, fromX + packet.side * width * .11, toX - packet.side * width * .10, toX, progress),
    bezier(y, y, targetY, targetY, progress)];
}

export function ringMesh(segments = 256, strips = 12) {
  const vertices = new Float32Array(segments * strips * 12);
  let offset = 0;
  for (let u = 0; u < segments; u++) for (let v = 0; v < strips; v++) {
    for (const [du, dv] of [[0, 0], [1, 0], [0, 1], [0, 1], [1, 0], [1, 1]]) {
      vertices[offset++] = (u + du) / segments;
      vertices[offset++] = (v + dv) / strips;
    }
  }
  return vertices;
}

export function packetMesh() {
  const vertices = [];
  for (const p of packets) for (let segment = 0; segment < 3; segment++) {
    for (const [end, edge] of [[0, -1], [1, -1], [0, 1], [0, 1], [1, -1], [1, 1]]) {
      vertices.push(p.side, p.lane, p.phase, p.speed, (segment + end) / 3, Number(p.reverse), edge);
    }
  }
  return new Float32Array(vertices);
}

function strokePath(vertices, points, width, color) {
  // Triangles give a real CSS-pixel stroke width on Metal/WebGL, where native lines can be limited to one pixel.
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (a[1] - b[1]) / length * width / 2, ny = (b[0] - a[0]) / length * width / 2;
    for (const [point, edge] of [[a, -1], [b, -1], [a, 1], [a, 1], [b, -1], [b, 1]]) {
      vertices.push(point[0] + nx * edge, point[1] + ny * edge, ...color);
    }
  }
}

export function routeMesh(width, height, palette) {
  const vertices = [], accent = rgb(palette.accent);
  for (let lane = 0; lane < 100; lane++) for (const side of [-1, 1]) {
    const points = Array.from({ length: 27 }, (_, step) => flowPoint({ lane: lane / 99, side }, step / 26, width, height));
    strokePath(vertices, points, lane % 5 ? 1.0 : 1.7, [...accent, lane % 5 ? .17 : .30]);
  }
  return new Float32Array(vertices);
}
