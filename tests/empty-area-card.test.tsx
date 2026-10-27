import React from "react";
import { it, expect, vi, afterEach, describe } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MapHome } from "../src/screens/MapHome";
import { DEFAULT_FILTERS, MAX_PERIOD_MONTHS } from "../src/state/market";
import type { Repository } from "../src/api/repository";
vi.mock("expo-location", () => ({}));
vi.mock("../src/screens/MarketSheets", () => ({
  ComplexContent: () => null,
  RegionContent: () => null,
}));
let moves = 0;
vi.mock("../src/map/MapCanvas", () => ({
  default: ({ onEvent }: any) => (
    <button
      onClick={() => {
        moves += 1;
        onEvent({
          type: "camera",
          lat: 35.16,
          lng: 129.16 + moves * 0.001,
          zoom: 14,
          bbox: [129.15, 35.15, 129.17 + moves * 0.001, 35.17],
        });
      }}
    >
      지도 이동
    </button>
  ),
}));
afterEach(cleanup);
// 거래 없는 지역 안내 카드는 X로 닫을 수 있고, 거래가 있는 곳을 한 번 거친 뒤 다시 빈 지역에 오기 전까지는 다시 뜨지 않는다
const marker = {
  kind: "complex",
  id: "c",
  name: "우동 단지",
  lat: 35.16,
  lng: 129.16,
  transaction_count: 3,
  property_type: "apartment",
};
function setup(period_months = DEFAULT_FILTERS.period_months) {
  let list: any[] = [];
  const markers = vi.fn(async () => ({
    data: { markers: list },
    meta: {},
  }));
  render(
    <MapHome
      repo={{ mode: "api", markers } as unknown as Repository}
      filters={{ ...DEFAULT_FILTERS, period_months }}
      onFilters={() => {}}
      onSearch={() => {}}
      onFilter={() => {}}
      onList={() => {}}
      onDate={() => {}}
      unit="평"
      onUnit={() => {}}
      base="normal"
      onBase={() => {}}
      cadastral={false}
      onCadastral={() => {}}
      onHelp={() => {}}
      notify={() => {}}
      onMeta={() => {}}
    />,
  );
  const moveTo = async (next: any[]) => {
    list = next;
    const before = markers.mock.calls.length;
    fireEvent.click(screen.getByText("지도 이동"));
    await waitFor(() => expect(markers.mock.calls.length).toBe(before + 1));
    await waitFor(() =>
      expect(screen.queryByText("실거래가 불러오는 중…")).toBeNull(),
    );
  };
  return { moveTo };
}
describe("거래 없는 지역 안내 카드", () => {
  it("기간 늘리기 카드에 닫기 버튼이 있고 누르면 사라진다", async () => {
    const { moveTo } = setup();
    await moveTo([]);
    await screen.findByText("이 조건의 거래가 없어요");
    expect(screen.getByText(/기간 늘리기/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    expect(screen.queryByText("이 조건의 거래가 없어요")).toBeNull();
  });
  it("기간을 더 늘릴 수 없는 카드도 닫기 버튼으로 없앨 수 있다", async () => {
    const { moveTo } = setup(MAX_PERIOD_MONTHS);
    await moveTo([]);
    await screen.findByText("이 조건의 거래가 없어요");
    expect(screen.queryByText(/기간 늘리기/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    expect(screen.queryByText("이 조건의 거래가 없어요")).toBeNull();
  });
  it("닫은 뒤 빈 지역 안에서 움직이면 다시 뜨지 않고, 거래 있는 곳을 거쳐 빈 지역에 오면 다시 뜬다", async () => {
    const { moveTo } = setup();
    await moveTo([]);
    fireEvent.click(await screen.findByRole("button", { name: "안내 닫기" }));
    await moveTo([]);
    expect(screen.queryByText("이 조건의 거래가 없어요")).toBeNull();
    await moveTo([marker]);
    expect(screen.queryByText("이 조건의 거래가 없어요")).toBeNull();
    await moveTo([]);
    await screen.findByText("이 조건의 거래가 없어요");
  });
});
