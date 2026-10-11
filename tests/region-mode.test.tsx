import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RegionContent } from "../src/screens/MarketSheets";
import { Repository } from "../src/api/repository";
import { ApiClient } from "../src/api/client";
import { DEFAULT_FILTERS } from "../src/state/market";
vi.mock("../src/components/Chart", () => ({
  Chart: () => <div>샘플 차트</div>,
}));
it("샘플 지역 시트를 API로 전환하면 이전 샘플 차트를 지운다", async () => {
  const props = {
    marker: {
      kind: "region" as const,
      region_code: "2635010500",
      name: "우동",
      lat: 35.16,
      lng: 129.14,
      transaction_count: 128,
      summary: { median_price_per_pyeong: 32000000 },
    },
    filters: DEFAULT_FILTERS,
    onList: () => {},
    onComplex: () => {},
    onHelp: () => {},
    unit: "평" as const,
  };
  const client = new ApiClient("http://api", "d", async () => { throw new Error("통계 요청 실패"); });
  const { rerender } = render(
    <RegionContent {...props} repo={new Repository("sample", client)} />,
  );
  await screen.findByText("샘플 차트");
  rerender(<RegionContent {...props} repo={new Repository("api", client)} />);
  await screen.findByText("지역·지도 영역의 거래 목록 API가 준비 중이에요");
  await waitFor(() => expect(screen.queryByText("샘플 차트")).toBeNull());
});
