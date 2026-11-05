const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export function normalizeLayout(value = {}, viewport = { width: 1920, height: 1080 }) {
  const width = Math.max(1, number(value.width, viewport.width));
  const height = Math.max(1, number(value.height, viewport.height));
  return {
    width, height, x: number(value.x, 0), y: number(value.y, 0),
    worldWidth: Math.max(width, number(value.worldWidth, width)),
    worldHeight: Math.max(height, number(value.worldHeight, height)),
    index: Math.max(0, number(value.index, 0)), count: Math.max(1, number(value.count, 1)),
    mainX: number(value.mainX, 0), mainY: number(value.mainY, 0),
    mainWidth: number(value.mainWidth, width), mainHeight: number(value.mainHeight, height),
    isMain: number(value.isMain, 1),
  };
}

export function layoutFromURL(search, viewport) {
  return normalizeLayout(Object.fromEntries(new URLSearchParams(search)), viewport);
}

export function sceneSize(layout) {
  // Exact existing dashboard rows + gaps, without changing its layout or CSS.
  const footer = layout.mainWidth >= 1700 ? 247 : layout.mainWidth > 1100 ? 220 : 210;
  return { width: layout.mainWidth, height: Math.max(680, layout.mainHeight) - footer };
}
