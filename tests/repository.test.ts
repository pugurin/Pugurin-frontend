import { describe, it, expect } from "vitest";
import { Repository } from "../src/api/repository";
import { ApiClient } from "../src/api/client";
import { DEFAULT_FILTERS, HOME } from "../src/state/market";
describe("메인 API 계약", () => {
  it("머지되지 않은 API를 요청하거나 샘플로 대체하지 않는다", async () => {
    let calls = 0;
    const repo = new Repository(
      "api",
      new ApiClient("http://api", "d", async () => {
        calls++;
        return new Response("{}");
      }),
    );
    for (const promise of [
      repo.analysis("id"),
      repo.transactions(DEFAULT_FILTERS, { bbox: HOME.bbox }),
    ])
      await expect(promise).rejects.toMatchObject({ code: "API_PENDING" });
    expect(calls).toBe(0);
  });
  it("검색과 단지 이력은 실제 계약에 있는 필드로 요청한다", async () => {
    const urls: string[] = [];
    const repo = new Repository(
      "api",
      new ApiClient("http://api", "d", async (url) => {
        urls.push(String(url));
        return new Response(JSON.stringify({ data: [] }));
      }),
    );
    await repo.search("해운대");
    await repo.transactions(DEFAULT_FILTERS, {
      complexId: "id",
      cancelled: true,
      page: 2,
      sort: "price_asc",
    });
    expect(urls[0]).toContain("/search?q=");
    expect(urls[1]).toContain("/complexes/id/transactions?");
    expect(urls[1]).toContain("include_cancelled=true");
    expect(urls[1]).not.toContain("period_months");
  });
});

it("지역·단지 통계는 머지된 경로와 필터를 사용하고 응답 평형을 보존한다", async () => {
  const urls: string[] = [];
  const data = {
    transaction_count: 6,
    trend: [],
    area_types: [
      {
        exclusive_area_m2: 84.9,
        exclusive_area_pyeong: 25.7,
        supply_area_pyeong: 34,
        transaction_count: 3,
        trend: [],
      },
    ],
  };
  const repo = new Repository(
    "api",
    new ApiClient("http://api", "d", async (url) => {
      urls.push(String(url));
      return new Response(
        JSON.stringify({ data, meta: { method: "중위값, 해제거래 제외" } }),
      );
    }),
  );
  const result = await repo.stats(
    { ...DEFAULT_FILTERS, deal_type: "monthly", exclude_direct: true },
    "id",
    "complex",
  );
  await repo.stats(
    { ...DEFAULT_FILTERS, period_months: 12 },
    "2635010500",
    "region",
  );
  expect(urls[0]).toContain("/complexes/id/stats?");
  expect(urls[0]).toContain("deal_type=monthly");
  expect(urls[0]).toContain("exclude_direct=true");
  expect(urls[0]).toContain("period_months=36");
  expect(urls[1]).toContain("/stats/regions/2635010500?");
  expect(urls[1]).toContain("period_months=12");
  expect(result.data).toEqual(data);
});
