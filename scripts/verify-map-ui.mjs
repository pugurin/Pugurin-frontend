import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PUGURIN_CHROMIUM_PATH,
});
const page = await browser.newPage({ viewport: { width: 360, height: 780 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  window.__cameras = [];
  window.addEventListener("message", (e) => {
    if (e.data?.type === "camera") window.__cameras.push(e.data);
  });
});
try {
  await page.goto("http://localhost:8081");
  await page.waitForTimeout(1500);
  const frame = page.frames().find((f) => f.url() === "about:srcdoc");
  assert.ok(frame);
  await frame.waitForFunction(
    () => document.getElementById("background").naturalWidth === 2000,
  );
  const camera = () => page.evaluate(() => window.__cameras.at(-1));
  const initial = await camera();
  assert.ok(
    initial.bbox[1] < 33.499 &&
      initial.bbox[3] > 37.566 &&
      initial.bbox[2] > 131.87,
  );
  const search = await page
    .getByRole("button", { name: "단지·주소·동네 검색" })
    .boundingBox();
  const zoom = await page
    .getByRole("button", { name: "지도 확대" })
    .boundingBox();
  assert.ok(search.height <= 42);
  assert.ok(zoom.height <= 38);
  await page.screenshot({ path: "/private/tmp/pugurin-fixed-home.png" });
  await page.getByRole("button", { name: "지도 축소" }).click();
  await page.waitForTimeout(350);
  const after = await camera();
  assert.ok(Math.abs(initial.zoom - after.zoom - 0.25) < 0.001);
  assert.ok(
    (after.bbox[3] - after.bbox[1]) / (initial.bbox[3] - initial.bbox[1]) <
      1.25,
  );
  await frame.locator("#map").hover();
  await page.mouse.wheel(0, -1000);
  await page.waitForTimeout(350);
  const wheel = await camera();
  assert.ok(Math.abs(wheel.zoom - after.zoom - 0.12) < 0.001);
  await frame.evaluate(() =>
    window.pugurinReceive({
      type: "move",
      lat: 37.566,
      lng: 126.978,
      zoom: 12,
    }),
  );
  await page.waitForTimeout(400);
  const moved = await camera();
  assert.equal(moved.lat,37.566);
  assert.equal(moved.lng,126.978);
  assert.equal(
    await page.getByText("부산 지역만 지원해요", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByText("이 조건의 거래가 없어요", { exact: true }).count(),
    0,
  );
  await page.screenshot({ path: "/private/tmp/pugurin-fixed-seoul.png" });
  await frame.evaluate(() =>
    window.pugurinReceive({ type: "move", lat: 36, lng: 128, zoom: 6.3 }),
  );
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "☷ 필터" }).click();
  const direct = page.getByLabel("직거래 제외");
  assert.equal(await direct.isChecked(), false);
  await page.screenshot({ path: "/private/tmp/pugurin-fixed-filter.png" });
  await direct.click();
  assert.equal(await direct.isChecked(), true);
  const responsePromise = page.waitForResponse(
    (r) =>
      r.url().includes("/map/markers?") &&
      r.url().includes("exclude_direct=true") &&
      r.status() === 200,
  );
  await page.getByRole("button", { name: "결과보기" }).click();
  await responsePromise;
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    JSON.stringify(
      {
        nationwide: true,
        compactSearchHeight: search.height,
        compactControlHeight: zoom.height,
        zoomStep: initial.zoom - after.zoom,
        wheelStep: wheel.zoom - after.zoom,
        outsidePopup: false,
        directSwitchApplied: true,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
