import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MapHome } from "../src/screens/MapHome";
import { DEFAULT_FILTERS } from "../src/state/market";
import type { Repository } from "../src/api/repository";
import type { Filters } from "../src/api/types";
vi.mock("expo-location", () => ({}));
vi.mock("../src/screens/MarketSheets", () => ({
  ComplexContent: () => null,
  RegionContent: () => null,
}));
vi.mock("../src/map/MapCanvas", () => ({ default: () => null }));

// 탭을 누르면 부모가 필터를 바꿔 다시 그리는 것까지 흉내 낸다
function Harness() {
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const markers = async () => ({
    data: { level: "dong", markers: [] },
    meta: {},
  });
  return (
    <MapHome
      repo={{ mode: "api", markers } as unknown as Repository}
      filters={filters}
      onFilters={setFilters}
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
    />
  );
}

describe("매물 유형 탭을 바꿀 때 로딩 화면", () => {
  afterEach(cleanup);
  it("다른 유형을 누르면 용어 팁과 함께 0.7초 정도 보이고 사라진다", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("오피스텔"));
    expect(screen.getByText("오피스텔 실거래가를 불러오는 중")).toBeTruthy();
    expect(screen.getByText("용어 자세히 ›")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 500));
    expect(screen.queryByText("오피스텔 실거래가를 불러오는 중")).toBeTruthy();
    await waitFor(
      () =>
        expect(
          screen.queryByText("오피스텔 실거래가를 불러오는 중"),
        ).toBeNull(),
      { timeout: 1500 },
    );
  });
  it("이미 선택된 탭을 다시 누르면 띄우지 않는다", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("아파트"));
    expect(screen.queryByText("아파트 실거래가를 불러오는 중")).toBeNull();
  });
  it("화면을 누르면 바로 닫힌다", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("빌라"));
    fireEvent.click(screen.getByLabelText("로딩 화면 닫기"));
    expect(screen.queryByText("빌라 실거래가를 불러오는 중")).toBeNull();
  });
});
