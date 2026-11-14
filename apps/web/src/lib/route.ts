type Point = { latitude: number; longitude: number };

/**
 * Equirectangular projection scaled to fit `width` × `height`, keeping the aspect ratio.
 * Good enough for the few kilometres a workout covers.
 */
export function projectRoute(
  points: readonly Point[],
  width: number,
  height: number,
  padding = 8,
): { x: number; y: number }[] {
  if (points.length === 0) return [];
  const meanLatitude = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
  const xScale = Math.cos((meanLatitude * Math.PI) / 180);
  const xs = points.map((p) => p.longitude * xScale);
  const ys = points.map((p) => p.latitude);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const scale = Math.min(
    spanX > 0 ? (width - 2 * padding) / spanX : Infinity,
    spanY > 0 ? (height - 2 * padding) / spanY : Infinity,
  );
  const factor = Number.isFinite(scale) ? scale : 0;
  const offsetX = (width - spanX * factor) / 2;
  const offsetY = (height - spanY * factor) / 2;
  return xs.map((x, index) => ({
    x: offsetX + (x - minX) * factor,
    y: height - (offsetY + ((ys[index] ?? minY) - minY) * factor),
  }));
}
