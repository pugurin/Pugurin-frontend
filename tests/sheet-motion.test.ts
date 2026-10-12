import { it, expect } from "vitest";
import {
  dragHeight,
  sheetStops,
  releaseSheet,
} from "../src/components/sheetMotion";
it("누른 위치를 기준으로 드래그 중 높이가 연속적으로 바뀐다", () => {
  const stops = sheetStops(700, 230);
  expect(dragHeight(230, -80, stops)).toBe(310);
  expect(dragHeight(230, -160, stops)).toBe(390);
  expect(dragHeight(490, 100, stops)).toBe(390);
});
it("높이와 속도로 스냅하고 작게 접힌 시트는 아래로 끌어 닫는다", () => {
  const stops = sheetStops(700, 230);
  expect(releaseSheet(380, 0, stops)).toBe("half");
  expect(releaseSheet(420, -1, stops)).toBe("full");
  expect(releaseSheet(90, 0, stops)).toBe("closed");
  expect(releaseSheet(600, 0, stops)).toBe("full");
});
it("작은 화면에서도 단계 순서와 화면 높이를 지킨다", () => {
  const s = sheetStops(300, 230);
  expect(s.peek).toBeLessThan(s.half);
  expect(s.half).toBeLessThan(s.full);
  expect(dragHeight(s.full, -500, s)).toBeLessThanOrEqual(s.full);
});
