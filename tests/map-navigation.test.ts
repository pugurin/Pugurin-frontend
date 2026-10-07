import { it, expect, vi, afterEach } from "vitest";
import { mapDocument } from "../src/map/document";
import { HOME } from "../src/state/market";
function map() {
  const events: any[] = [];
  (window as any).ReactNativeWebView = {
    postMessage: (s: string) => events.push(JSON.parse(s)),
  };
  const html = mapDocument("", HOME);
  document.body.innerHTML = html.split("<body>")[1].split("<script>")[0];
  const el = document.getElementById("map")!;
  Object.defineProperties(el, {
    clientWidth: { value: 360 },
    clientHeight: { value: 480 },
  });
  window.eval(html.split("<script>")[1].split("</script>")[0]);
  return {
    camera: () => events.filter((e) => e.type === "camera").at(-1),
    move: (c: unknown) =>
      (window as any).pugurinReceive({ type: "move", ...(c as object) }),
    zoom: (delta: number) =>
      (window as any).pugurinReceive({ type: "zoom", delta }),
  };
}
afterEach(() => {
  delete (window as any).ReactNativeWebView;
  vi.useRealTimers();
});
it("초기 지도에 서울과 제주가 함께 들어간다", () => {
  const { camera } = map();
  const b = camera().bbox;
  for (const [lng, lat] of [
    [126.978, 37.566],
    [126.531, 33.499],
  ])
    expect(lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3]).toBe(true);
});
it("줌 버튼 한 번으로 지도 범위가 두 배로 뛰지 않는다", async () => {
  vi.useFakeTimers();
  const m = map();
  const before = m.camera().bbox;
  m.zoom(-1);
  await vi.advanceTimersByTimeAsync(400);
  const after = m.camera().bbox;
  expect((after[3] - after[1]) / (before[3] - before[1])).toBeLessThanOrEqual(
    1.25,
  );
  expect(after[3] - after[1]).toBeGreaterThan(before[3] - before[1]);
});
it("전국 화면은 부산과 떨어진 동쪽 섬까지 탐색할 수 있는 범위로 시작한다", () => {
  const { camera } = map();
  const b = camera().bbox;
  expect(b[2]).toBeGreaterThan(131.87);
});

it("줌 전환 중 다른 위치로 이동하면 이전 줌이 새 위치의 확대 수준을 덮어쓰지 않는다", async () => {
  vi.useFakeTimers();
  const m = map();
  m.zoom(1);
  await vi.advanceTimersByTimeAsync(32);
  m.move({ lat: 35.16, lng: 129.16, zoom: 15 });
  await vi.advanceTimersByTimeAsync(400);
  expect(m.camera().zoom).toBe(15);
});
