import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PUGURIN_CHROMIUM_PATH,
});
const page = await browser.newPage({ viewport: { width: 360, height: 780 } });
const errors = [],
  responses = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.url().includes("/api/v1/"))
    responses.push({ url: r.url(), status: r.status() });
});
await page.goto("http://localhost:8081");
await page.waitForTimeout(2500);
await page.screenshot({ path: "/private/tmp/pugurin-home.png" });
await page.getByRole("button", { name: "단지·주소·동네 검색" }).click();
await page.getByPlaceholder("단지·주소·동네 검색").fill("우동롯데");
await page.getByText("우동롯데캐슬", { exact: true }).waitFor();
await page.getByText("우동롯데캐슬", { exact: true }).click();
await page.getByText("위로 올리면 단지 정보를 더 볼 수 있어요 ⌃").waitFor();
await page.screenshot({ path: "/private/tmp/pugurin-peek.png" });
await page.getByText("위로 올리면 단지 정보를 더 볼 수 있어요 ⌃").click();
await page.getByText("━ 이 단지　┅ 해당 지역 전체", { exact: true }).waitFor();
await page.getByRole("button", { name: "자세히 보기" }).click();
await page.getByText("거래 이력", { exact: true }).waitFor();
await page.screenshot({ path: "/private/tmp/pugurin-full.png" });
await page.getByRole("button", { name: "시트 닫기" }).click();
const frame = page.frames().find((f) => f.url() === "about:srcdoc");
await frame.evaluate(() =>
  window.pugurinReceive({ type: "move", lat: 35.17, lng: 129.13, zoom: 11 }),
);
await page.waitForTimeout(1000);
await frame.locator(".marker.region").first().waitFor();
await frame.locator(".marker.region").first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: "/private/tmp/pugurin-region-entry.png" });
await page
  .getByText("월별 평당가 (중위값)", { exact: true })
  .waitFor({ state: "attached" });
await page
  .getByText("월별 평당가 (중위값)", { exact: true })
  .scrollIntoViewIfNeeded();
await page.getByLabel("월별 평당가 중위값 추이").waitFor();
await page.screenshot({ path: "/private/tmp/pugurin-region.png" });
await page.getByRole("button", { name: "시트 닫기" }).click();
await page.getByRole("button", { name: "목록 보기" }).click();
await page
  .getByText("지역·지도 영역의 거래 목록 API가 준비 중이에요", { exact: true })
  .waitFor();
await page.getByRole("button", { name: "뒤로 가기" }).click();
await page.getByRole("tab", { name: "용어사전" }).click();
await page.getByPlaceholder("궁금한 용어를 검색하세요").fill("용적률");
await page.getByText("용적률", { exact: true }).last().click();
await page.getByText("쉽게 풀면", { exact: true }).waitFor();
await page.screenshot({ path: "/private/tmp/pugurin-glossary.png" });
await page.getByRole("button", { name: "뒤로 가기" }).click();
await page.getByRole("tab", { name: "더보기" }).click();
await page.getByRole("button", { name: "샘플 화면 보기" }).click();
await page.getByRole("tab", { name: "지도", exact: true }).click();
await page.waitForTimeout(700);
assert.equal(await page.getByRole("button", { name: "시트 닫기" }).count(), 0);
await page.screenshot({ path: "/private/tmp/pugurin-sample-home.png" });
assert.equal(errors.length, 0, errors.join("\n"));
assert.ok(responses.some((r) => r.url.includes("/stats?") && r.status === 200));
assert.ok(
  responses.some((r) => r.url.includes("/stats/regions/") && r.status === 200),
);
assert.ok(
  responses.some((r) => r.url.includes("/search?") && r.status === 200),
);
assert.ok(
  responses.some((r) => r.url.includes("/transactions?") && r.status === 200),
);
assert.ok(
  responses.every((r) => r.status === 200 || r.status === 304),
  JSON.stringify(responses),
);
console.log(JSON.stringify({ errors, responses }, null, 2));
await browser.close();
