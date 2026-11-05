export const mint = '139,244,216';
export const white = '216,234,230';
export const hash = value => {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  result = Math.imul(result ^ (result >>> 16), 0x7feb352d);
  result = Math.imul(result ^ (result >>> 15), 0x846ca68b);
  result ^= result >>> 16;
  return (result >>> 0) / 4294967295;
};

export function rim(y, width, height, outer = false) {
  const normal = (y - height * .47) / (height * .73);
  const mobile = width < 720;
  return width * ((mobile ? .78 : .43) - (mobile ? .05 : .12) * normal * normal + (outer ? (mobile ? .35 : .235) : 0));
}

export function bandPath(ctx, width, height) {
  ctx.beginPath();
  ctx.moveTo(rim(0, width, height), 0);
  for (let y = 0; y <= height + 8; y += 8) ctx.lineTo(rim(y, width, height), y);
  for (let y = height + 8; y >= -8; y -= 8) ctx.lineTo(rim(y, width, height, true), y);
  ctx.closePath();
}

export function traceRim(ctx, width, height, outer, offset = 0) {
  ctx.beginPath();
  for (let y = -8; y < height + 8; y += 8) {
    const x = rim(y, width, height, outer) + offset;
    if (y === -8) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function bezier(a, b, c, d, t) {
  const s = 1 - t;
  return s * s * s * a + 3 * s * s * t * b + 3 * s * t * t * c + t * t * t * d;
}
