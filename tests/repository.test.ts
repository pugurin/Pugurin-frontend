import { describe, it, expect } from "vitest";
import { Repository, SCHOOL_SEARCH_WAIT_MS } from "../src/api/repository";
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
    const tx = urls.find((u) => u.includes("/transactions?"))!;
    expect(tx).toContain("/complexes/id/transactions?");
    expect(tx).toContain("include_cancelled=true");
    expect(tx).not.toContain("period_months");
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

describe("학교 이름 검색", () => {
  const school = (id: string, name: string, lat: number | null = 35.17) => ({
    id, name, kind: null, level: "elementary", foundation: null, coed: null,
    address: `부산광역시 ${name}`, lat, lng: 129.08, tel: null, homepage: null, opened_on: null, distance_m: null,
  });
  const api = (schools: (u: string) => Response) => {
    const urls: string[] = [];
    const repo = new Repository(
      "api",
      new ApiClient("http://api", "d", async (value) => {
        const u = decodeURIComponent(String(value));
        urls.push(u);
        return u.includes("/schools?")
          ? schools(u)
          : new Response(JSON.stringify({ data: [{ type: "region", name: "연산동", lat: 35.18, lng: 129.08 }] }));
      }),
    );
    return { repo, urls };
  };

  it("부산 학교 목록을 초등·그 밖으로 나눠 한 번 받아 두고, 이름이 맞는 학교를 통합 검색 뒤에 붙인다", async () => {
    const { repo, urls } = api((u) =>
      new Response(JSON.stringify({
        data: u.includes("level=elementary")
          ? [school("e1", "연신초등학교"), school("e2", "연산초등학교"), school("e3", "연신 좌표없는초", null)]
          : [school("m1", "연신중학교")],
      })),
    );
    const r = await repo.search("연신");
    expect(r.data.map((x) => x.name)).toEqual(["연산동", "연신초등학교", "연신중학교"]);
    expect(r.data[1]).toMatchObject({ type: "school", school: { id: "e1" } });
    const schoolUrls = urls.filter((u) => u.includes("/schools?"));
    expect(schoolUrls).toHaveLength(2);
    expect(schoolUrls[0]).toContain("bbox=128.75,34.85,129.35,35.4");
    expect(schoolUrls.map((u) => u.split("level=")[1])).toEqual(["elementary", "middle,high,special,other"]);
    // 띄어쓰기는 무시하고, 두 번째 검색은 받아 둔 목록을 쓴다
    expect((await repo.search("연신 초")).data.map((x) => x.name)).toContain("연신초등학교");
    expect(urls.filter((u) => u.includes("/schools?"))).toHaveLength(2);
  });

  it("학교 목록을 못 받아도 통합 검색 결과는 그대로 주고, 다음 검색에서 다시 받는다", async () => {
    let fail = true;
    const { repo, urls } = api(() =>
      fail
        ? new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "x" } }), { status: 500 })
        : new Response(JSON.stringify({ data: [school("e1", "연신초등학교")] })),
    );
    expect((await repo.search("연신")).data.map((x) => x.name)).toEqual(["연산동"]);
    fail = false;
    expect((await repo.search("연신")).data.map((x) => x.name)).toContain("연신초등학교");
    expect(urls.filter((u) => u.includes("/schools?")).length).toBeGreaterThan(2);
  });

  it("학교 목록이 늦으면 기다리지 않고 통합 검색 결과만 준다", async () => {
    const urls: string[] = [];
    const repo = new Repository(
      "api",
      new ApiClient("http://api", "d", async (value) => {
        const u = decodeURIComponent(String(value));
        urls.push(u);
        // 학교 목록은 끝나지 않는다
        if (u.includes("/schools?")) return new Promise<Response>(() => {});
        return new Response(JSON.stringify({ data: [{ type: "region", name: "연산동", lat: 35.18, lng: 129.08 }] }));
      }),
    );
    const start = Date.now();
    expect((await repo.search("연신")).data.map((x) => x.name)).toEqual(["연산동"]);
    expect(Date.now() - start).toBeLessThan(SCHOOL_SEARCH_WAIT_MS + 500);
    // 검색이 취소되면 학교를 기다리지 않고 바로 끝낸다
    const controller = new AbortController();
    const pending = repo.search("연신", controller.signal);
    await new Promise((r) => setTimeout(r, 20));
    const aborted = Date.now();
    controller.abort();
    await pending;
    expect(Date.now() - aborted).toBeLessThan(SCHOOL_SEARCH_WAIT_MS);
    // 받는 중인 목록은 다시 부르지 않는다
    expect(urls.filter((u) => u.includes("/schools?"))).toHaveLength(2);
  });

  it("미리 받아 둔 학교 목록으로 첫 검색에서도 학교를 찾는다", async () => {
    const { repo, urls } = api(() => new Response(JSON.stringify({ data: [school("e1", "연신초등학교")] })));
    repo.prefetchSchools();
    expect(urls.filter((u) => u.includes("/schools?"))).toHaveLength(2);
    expect((await repo.search("연신")).data.map((x) => x.name)).toContain("연신초등학교");
    expect(urls.filter((u) => u.includes("/schools?"))).toHaveLength(2);
  });

  it("샘플 모드는 샘플 학교에서 찾는다", async () => {
    const repo = new Repository("sample", {} as never);
    const r = await repo.search("우동초");
    expect(r.data).toEqual([expect.objectContaining({ type: "school", name: "우동초등학교" })]);
  });
});
