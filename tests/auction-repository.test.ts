import { describe, it, expect } from "vitest";
import { Repository } from "../src/api/repository";
import { ApiClient } from "../src/api/client";
import { COMPLEXES } from "../src/api/fixtures";

const apiRepo = (urls: string[]) =>
  new Repository(
    "api",
    new ApiClient("http://api", "d", async (url) => {
      urls.push(String(url));
      return new Response(JSON.stringify({ data: [] }));
    }),
  );

describe("경매 Repository", () => {
  it("경매 목록은 실제 쿼리 이름으로 부른다", async () => {
    const urls: string[] = [];
    await apiRepo(urls).auctions({
      bbox: [129.1, 35.1, 129.2, 35.2],
      groups: ["apartment"],
      source: "court",
      includeClosed: true,
      page: 2,
      pageSize: 100,
    });
    const url = urls[0];
    expect(url).toContain("/auctions?");
    expect(url).toContain("bbox=129.1%2C35.1%2C129.2%2C35.2");
    expect(url).toContain("property_group=apartment");
    expect(url).toContain("source=court");
    expect(url).toContain("include_closed=true");
    expect(url).toContain("page=2");
    expect(url).toContain("page_size=100");
    expect(url).not.toContain("sort="); // 넘기지 않은 값은 빼고 보낸다
  });
  it("그룹 여러 개는 쉼표로 잇고 지분 제외는 exclude_share로 보낸다", async () => {
    const urls: string[] = [];
    await apiRepo(urls).auctions({
      groups: ["apartment", "villa"],
      excludeShare: true,
      sort: "min_price_ratio",
    });
    expect(urls[0]).toContain("property_group=apartment%2Cvilla");
    expect(urls[0]).toContain("exclude_share=true");
    expect(urls[0]).toContain("sort=min_price_ratio");
  });
  it("단지 경매는 complex_id로, 상세는 id 경로로 부른다", async () => {
    const urls: string[] = [];
    const repo = apiRepo(urls);
    await repo.auctions({ complexId: "c-1" });
    await repo.auction("court:2025타경1");
    expect(urls[0]).toContain("complex_id=c-1");
    expect(urls[1]).toContain("/auctions/court%3A2025%ED%83%80%EA%B2%BD1");
  });
  it("샘플 모드는 bbox 안 샘플과 상세를 돌려준다", async () => {
    const sample = new Repository("sample", new ApiClient("http://x", "d"));
    const list = await sample.auctions({ complexId: COMPLEXES[0].id });
    expect(list.data.length).toBeGreaterThan(0);
    expect(list.meta?.source_attribution).toBe("대법원 법원경매정보");
    expect(
      (await sample.auction(list.data[0].id)).data.schedule.length,
    ).toBeGreaterThan(0);
  });
  it("샘플 모드는 bbox·출처·그룹·지분으로 거른다", async () => {
    const sample = new Repository("sample", new ApiClient("http://x", "d"));
    const all = await sample.auctions({});
    expect(all.data.length).toBe(3);
    const far = await sample.auctions({ bbox: [128.0, 34.0, 128.1, 34.1] });
    expect(far.data).toEqual([]);
    const pub = await sample.auctions({ source: "public" });
    expect(pub.data.every((a) => a.source === "public")).toBe(true);
    const villa = await sample.auctions({ groups: ["villa"] });
    expect(villa.data.every((a) => a.property_group === "villa")).toBe(true);
    expect(villa.data.length).toBeGreaterThan(0);
    const noShare = await sample.auctions({ excludeShare: true });
    expect(noShare.data.some((a) => a.is_share)).toBe(false);
  });
  it("샘플 상세는 없는 id면 RESOURCE_NOT_FOUND로 거절한다", async () => {
    const sample = new Repository("sample", new ApiClient("http://x", "d"));
    await expect(sample.auction("nope")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });
});
