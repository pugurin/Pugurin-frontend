export type Stops = { peek: number; half: number; full: number };
export function sheetStops(height: number, peek: number): Stops {
  return {
    peek: Math.min(peek, height * 0.42),
    half: Math.min(490, height * 0.7),
    full: height * 0.96,
  };
}
export function dragHeight(start: number, dy: number, stops: Stops) {
  return Math.max(0, Math.min(stops.full, start - dy));
}
export function releaseSheet(
  height: number,
  velocity: number,
  stops: Stops,
): "peek" | "half" | "full" | "closed" {
  if (height < stops.peek * 0.55 || (velocity > 0.8 && height < stops.peek))
    return "closed";
  const projected = height - velocity * 180;
  return (Object.keys(stops) as ("peek" | "half" | "full")[]).reduce((a, b) =>
    Math.abs(stops[a] - projected) < Math.abs(stops[b] - projected) ? a : b,
  );
}
