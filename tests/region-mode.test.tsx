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

const sheetProps = (code: string, name: string) => ({
  marker: {
    kind: "region" as const,
    region_code: code,
    name,
    lat: 35.16,
    lng: 129.14,
    transaction_count: 1,
    summary: { median_price_per_pyeong: 1 },
  },
  filters: DEFAULT_FILTERS,
  onList: () => {},
  onComplex: () => {},
  onHelp: () => {},
  unit: "평" as const,
});
const offlineRepo = () =>
  new Repository(
    "api",
    new ApiClient("http://api", "d", async () => {
      throw new Error("x");
    }),
  );

it("동(10자리) 지역 시트에는 관심 지역 별이 있고 구(5자리)에는 없다", async () => {
  cleanup();
  const { unmount } = render(
    <RegionContent {...sheetProps("2635010500", "우동")} repo={offlineRepo()} />,
  );
  expect(screen.getByRole("button", { name: "우동 관심 지역 등록" })).toBeTruthy();
  unmount();
  render(
    <RegionContent {...sheetProps("26350", "해운대구")} repo={offlineRepo()} />,
  );
  expect(screen.queryByRole("button", { name: /관심 지역/ })).toBeNull();
});
