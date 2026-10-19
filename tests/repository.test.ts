import { describe, it, expect } from "vitest";
import { Repository } from "../src/api/repository";
import { ApiClient } from "../src/api/client";
import { DEFAULT_FILTERS, HOME } from "../src/state/market";
describe("메인 API 계약", () => {
  it("단지 분석은 실제 머지된 경로와 거래 조건으로 조회한다", async () => {
    let url = "";
    const data = {
      zonings: null,
      region: { name: "우동", region_code: "2635010500" },
      comparison: null,
      disclaimer: "참고용 정보",
    };
    const repo = new Repository(
      "api",
      new ApiClient("http://api", "d", async (value) => {
        url = String(value);
        return new Response(
          JSON.stringify({
            data,
            meta: { zoning_unavailable_reason: "source_unavailable" },
          }),
        );
      }),
    );
    const result = await repo.analysis("id", undefined, {
      ...DEFAULT_FILTERS,
      deal_type: "jeonse",
      exclude_direct: true,
    });
    expect(url).toContain("/analysis/complexes/id?");
    expect(url).toContain("deal_type=jeonse");
    expect(url).toContain("exclude_direct=true");
    // 비교 문구가 추이 그래프 아래에 붙으므로 그래프와 같은 기본 3년
    expect(url).toContain("period_months=36");
    expect(result.data).toEqual(data);
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
  // 단지 추이는 기본 3년
  expect(urls[0]).toContain("period_months=36");
  expect(urls[1]).toContain("/stats/regions/2635010500?");
  expect(urls[1]).toContain("period_months=12");
  expect(result.data).toEqual(data);
});

it("토지 거래는 머지된 지도 영역 목록 API로 요청한다", async () => {
  const urls: string[] = [];
  const repo = new Repository(
    "api",
    new ApiClient("http://api", "d", async (url) => {
      urls.push(String(url));
      return new Response(JSON.stringify({ data: [] }));
    }),
  );
  await repo.transactions(
    { ...DEFAULT_FILTERS, property_type: "land", deal_type: "sale" },
    { bbox: HOME.bbox },
  );
  expect(urls[0]).toContain("/transactions?");
  expect(urls[0]).toContain("property_type=land");
  expect(urls[0]).toContain("bbox=");
});
