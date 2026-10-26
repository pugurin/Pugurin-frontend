import React from "react";
import { it, expect, vi, afterEach, describe } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ComplexContent, RegionContent } from "../src/screens/MarketSheets";
import { DEFAULT_FILTERS } from "../src/state/market";
vi.mock("../src/components/Chart", () => ({
  Chart: () => <div>차트</div>,
}));
afterEach(cleanup);
// 단지·동 시트 제목 줄 오른쪽에서 바로 평/㎡를 바꾼다. 지도 레이어 팝업의 단위 설정과 같은 값을 쓴다
const repo: any = {
  mode: "api",
  complex: async () => ({
    data: {
      id: "c",
      name: "우동 단지",
      property_type: "apartment",
      address: "부산 우동",
      region_code: "2635010500",
      area_types: [{ exclusive_area_m2: 84, exclusive_area_pyeong: 25.4 }],
    },
  }),
  transactions: async () => ({ data: [] }),
  analysis: async () => ({ data: null }),
  stats: async () => ({ data: { trend: [], transaction_count: 0 } }),
};
const marker = {
  kind: "region" as const,
  region_code: "2635010500",
  name: "우동",
  lat: 35.16,
  lng: 129.14,
  transaction_count: 128,
  summary: { median_price_per_pyeong: 32000000 },
};
describe("시트 면적 단위 토글", () => {
  it("동 시트에서 ㎡를 누르면 단위를 ㎡로 바꾼다", async () => {
    const onUnit = vi.fn();
    render(
      <RegionContent
        marker={marker}
        filters={DEFAULT_FILTERS}
        repo={repo}
        onList={() => {}}
        onComplex={() => {}}
        onHelp={() => {}}
        unit="평"
        onUnit={onUnit}
      />,
    );
    const group = screen.getByLabelText("면적 단위");
    expect(group.textContent).toContain("평");
    fireEvent.click(screen.getByRole("button", { name: "㎡로 보기" }));
    expect(onUnit).toHaveBeenCalledWith("㎡");
  });
  it("단지 시트에서 평을 누르면 단위를 평으로 바꾸고, 지금 단위는 선택된 상태로 보인다", async () => {
    const onUnit = vi.fn();
    render(
      <ComplexContent
        id="c"
        repo={repo}
        filters={DEFAULT_FILTERS}
        stage="half"
        onStage={() => {}}
        onHelp={() => {}}
        notify={() => {}}
        unit="㎡"
        onUnit={onUnit}
      />,
    );
    await screen.findByText("우동 단지");
    const m2 = screen.getByRole("button", { name: "㎡로 보기" });
    expect(m2.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "평으로 보기" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "평으로 보기" }));
    expect(onUnit).toHaveBeenCalledWith("평");
  });
  it("onUnit을 넘기지 않으면 토글을 그리지 않는다", () => {
    render(
      <RegionContent
        marker={marker}
        filters={DEFAULT_FILTERS}
        repo={repo}
        onList={() => {}}
        onComplex={() => {}}
        onHelp={() => {}}
        unit="평"
      />,
    );
    expect(screen.queryByLabelText("면적 단위")).toBeNull();
  });
});
