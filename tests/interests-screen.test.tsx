import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InterestsScreen } from "../src/screens/InterestsScreen";
import { InterestsProvider, type InterestsValue } from "../src/state/interests";
import type { ComplexInterest, RegionInterest } from "../src/api/interests";
import { TRANSACTIONS } from "../src/api/fixtures";
afterEach(cleanup);

const sale = TRANSACTIONS.find((t) => t.deal_type === "sale")!;
const c = (id: string, name: string, latest = sale): ComplexInterest => ({
  complex_id: id, name, property_type: "apartment", address: "부산광역시 해운대구 우동", lat: 35, lng: 129, created_at: "2026-11-13", latest,
});
const r: RegionInterest = { region_code: "2635010500", name: "우동", lat: 35.16, lng: 129.14, created_at: "2026-11-13" };
const value = (over: Partial<InterestsValue> = {}): InterestsValue => ({
  signedIn: true,
  complexes: [c("c1", "해운대아이파크"), c("c2", "두산위브")],
  regions: [r],
  busy: [],
  hasComplex: () => true,
  hasRegion: () => true,
  toggleComplex: vi.fn(async () => {}),
  toggleRegion: vi.fn(async () => {}),
  ...over,
});
function show(v: InterestsValue) {
  const onComplex = vi.fn();
  const onRegion = vi.fn();
  render(
    <InterestsProvider value={v}>
      <InterestsScreen onBack={() => {}} onComplex={onComplex} onRegion={onRegion} unit="평" />
    </InterestsProvider>,
  );
  return { onComplex, onRegion };
}

describe("관심 목록 화면", () => {
  it("탭에 개수, 단지 행에 이름·최근 거래를 보여 주고 누르면 그 단지로 간다", () => {
    const { onComplex } = show(value());
    expect(screen.getByText("단지 2")).toBeTruthy();
    expect(screen.getByText("지역 1/10")).toBeTruthy();
    expect(screen.getByText("해운대아이파크")).toBeTruthy();
    expect(screen.getAllByText(/억/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText("해운대아이파크 지도에서 보기"));
    expect(onComplex).toHaveBeenCalledWith("c1");
  });

  it("최근 거래가 없는 단지는 그렇게 알려 준다", () => {
    show(value({ complexes: [c("c3", "새 단지", null as any)] }));
    expect(screen.getByText("최근 거래 정보 없음")).toBeTruthy();
  });

  it("지역 탭에서 행을 누르면 그 동으로 가고, ★는 해제한다", () => {
    const v = value();
    const { onRegion } = show(v);
    fireEvent.click(screen.getByText("지역 1/10"));
    fireEvent.click(screen.getByLabelText("우동 지도에서 보기"));
    expect(onRegion).toHaveBeenCalledWith(r);
    fireEvent.click(screen.getByLabelText("관심 지역 해제"));
    expect(v.toggleRegion).toHaveBeenCalledWith({ region_code: r.region_code, name: "우동", lat: r.lat, lng: r.lng });
  });

  it("비어 있으면 담는 방법을 알려 준다", () => {
    show(value({ complexes: [], regions: [] }));
    expect(screen.getByText("지도에서 ☆를 눌러 담아 보세요")).toBeTruthy();
    fireEvent.click(screen.getByText("지역 0/10"));
    expect(screen.getByText("지도에서 ☆를 눌러 담아 보세요")).toBeTruthy();
  });
});
