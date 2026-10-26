import { describe, it, expect } from "vitest";
import { ApiClient, DATA_NOT_READY_MESSAGE } from "../src/api/client";
import { Repository } from "../src/api/repository";
import {
  DEFAULT_FILTERS,
  HOME,
  changeDeal,
  changeProperty,
  draftFor,
  queryForFilters,
  validateDraft,
} from "../src/state/market";
import type { Filters } from "../src/api/types";

const capture = (body: unknown = { data: [] }) => {
  const urls: string[] = [];
  const repo = new Repository(
    "api",
    new ApiClient("http://api", "d", async (url) => {
      urls.push(String(url));
      return new Response(JSON.stringify(body));
    }),
  );
  return { urls, repo };
};
const jeonse: Filters = {
  ...DEFAULT_FILTERS,
  deal_type: "jeonse",
  include_renewals: true,
};

describe("실데이터 전용 백엔드", () => {
  it("DATA_NOT_READY는 데이터 준비 중 문구로 바꿔 전달한다", async () => {
    const client = new ApiClient(
      "http://api",
      "d",
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "DATA_NOT_READY",
              message: "실거래 데이터가 아직 없어요",
            },
          }),
          { status: 503, headers: { "X-Data-Mode": "none" } },
        ),
    );
    await expect(client.get("/map/markers")).rejects.toMatchObject({
      code: "DATA_NOT_READY",
      message: DATA_NOT_READY_MESSAGE,
    });
  });
});

describe("갱신 계약 포함 필터", () => {
  it("전·월세에서 켜면 지도·거래·단지 이력·통계·분석 요청에 싣는다", async () => {
    const { urls, repo } = capture();
    await repo.markers(jeonse, HOME.bbox, 12);
    await repo.transactions(jeonse, { bbox: HOME.bbox });
    await repo.transactions(jeonse, { complexId: "c1" });
    await repo.stats(jeonse, "c1", "complex");
    await repo.stats(jeonse, "2635010500", "region");
    await repo.analysis("c1", undefined, jeonse);
    expect(urls).toHaveLength(6);
    urls.forEach((u) => expect(u).toContain("include_renewals=true"));
  });
  it("꺼져 있거나 매매면 보내지 않는다 (서버 기본: 신규 계약만)", async () => {
    const { urls, repo } = capture();
    await repo.markers(
      { ...jeonse, include_renewals: undefined },
      HOME.bbox,
      12,
    );
    await repo.stats({ ...jeonse, deal_type: "sale" }, "c1", "complex");
    urls.forEach((u) => expect(u).not.toContain("include_renewals"));
  });
  it("매매로 바꾸거나 토지로 바꾸면 갱신 포함을 지운다", () => {
    expect(changeDeal(jeonse, "monthly").include_renewals).toBe(true);
    expect(changeDeal(jeonse, "sale")).not.toHaveProperty("include_renewals");
    expect(changeProperty(jeonse, "land")).not.toHaveProperty(
      "include_renewals",
    );
    expect(
      queryForFilters(changeDeal(jeonse, "sale")).has("include_renewals"),
    ).toBe(false);
  });
  it("필터 화면의 토글 값을 그대로 적용한다", () => {
    const off = validateDraft(jeonse, { ...draftFor(jeonse), renewals: false });
    expect(off.filters).not.toHaveProperty("include_renewals");
    const on = validateDraft(
      { ...jeonse, include_renewals: undefined },
      { ...draftFor(jeonse), renewals: true },
    );
    expect(on.filters?.include_renewals).toBe(true);
  });
});

describe("단건 조회", () => {
  it("거래·필지·용어를 ID로 조회한다", async () => {
    const { urls, repo } = capture({ data: null });
    await repo.transaction("tx-1");
    await repo.parcel("2635010500100010000");
    await repo.term("jeonse");
    expect(urls).toEqual([
      "http://api/transactions/tx-1",
      "http://api/parcels/2635010500100010000",
      "http://api/glossary/jeonse",
    ]);
  });
});
