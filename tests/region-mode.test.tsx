import React from "react";
import { it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
  await screen.findAllByText("네트워크에 연결할 수 없어요. 연결 상태를 확인해 주세요");
  await waitFor(() => expect(screen.queryByText("샘플 차트")).toBeNull());
});

// 관심 지역을 없앴다: 동(10자리) 지역 시트에도 관심 별이 없다
it("지역 시트에는 관심 별이 없다", () => {
  cleanup();
  render(
    <RegionContent
      marker={{
        kind: "region" as const,
        region_code: "2635010500",
        name: "우동",
        lat: 35.16,
        lng: 129.14,
        transaction_count: 1,
        summary: { median_price_per_pyeong: 1 },
      }}
      filters={DEFAULT_FILTERS}
      onList={() => {}}
      onComplex={() => {}}
      onHelp={() => {}}
      unit="평"
      repo={
        new Repository(
          "api",
          new ApiClient("http://api", "d", async () => {
            throw new Error("x");
          }),
        )
      }
    />,
  );
  expect(screen.queryByRole("button", { name: /관심/ })).toBeNull();
});
