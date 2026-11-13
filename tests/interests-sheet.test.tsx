import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ComplexContent, RegionContent } from "../src/screens/MarketSheets";
import { DEFAULT_FILTERS } from "../src/state/market";
vi.mock("../src/components/Chart", () => ({ Chart: () => <div>차트</div> }));
afterEach(cleanup);
const flush = () => act(() => new Promise((r) => setTimeout(r, 5)));
const repo: any = {
  mode: "api",
  complex: async () => ({
    data: {
      id: "c",
      name: "우동 단지",
      property_type: "apartment",
      address: "부산 우동",
      region_code: "2635010500",
      lat: 35,
      lng: 129,
      area_types: [{ exclusive_area_m2: 84, exclusive_area_pyeong: 25.4 }],
    },
  }),
  transactions: async () => ({ data: [] }),
  analysis: async () => ({ data: null }),
  auctions: async () => ({ data: [] }),
  stats: async () => ({ data: { trend: [], transaction_count: 0 } }),
};
const region = (region_code: string, name: string) => (
  <RegionContent
    marker={{ kind: "region", region_code, name, lat: 35, lng: 129, transaction_count: 1, summary: {} }}
    filters={DEFAULT_FILTERS}
    repo={repo}
    onList={() => {}}
    onComplex={() => {}}
    onHelp={() => {}}
    unit="평"
  />
);

describe("시트의 관심 ☆", () => {
  it("단지 시트에 관심 단지 ☆가 있고 '2차에서 열려요' 안내는 없다", async () => {
    render(
      <ComplexContent id="c" repo={repo} filters={DEFAULT_FILTERS} stage="peek" onStage={() => {}} onHelp={() => {}} notify={() => {}} unit="평" />,
    );
    await flush();
    // 켜고 끄는 버튼이라 선택 상태를 알린다(예전 '2차에서 열려요' 버튼에는 없었다)
    expect(screen.getByLabelText("관심 단지 등록").getAttribute("aria-pressed")).toBe("false");
  });

  it("동 시트에는 관심 지역 ☆가 있고 시·군·구 시트에는 없다", async () => {
    render(region("2635010500", "우동"));
    await flush();
    expect(screen.getByLabelText("관심 지역 등록")).toBeTruthy();
    cleanup();
    render(region("26350", "해운대구"));
    await flush();
    expect(screen.queryByLabelText("관심 지역 등록")).toBeNull();
  });
});
