import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApiClient } from "../src/api/client";
import { Repository } from "../src/api/repository";
import { CommuteScreen, CommuteSection } from "../src/screens/Commute";
import { CommuteProvider, legText, minutesLabel, type CommuteApi, type Place } from "../src/state/commute";
import type { TransitResult } from "../src/api/transit";

afterEach(cleanup);

const HOME: Place = { name: "해운대 샘플 단지", lat: 35.163102, lng: 129.163598 };
const WORK: Place = { name: "서면 사무실", lat: 35.154612, lng: 129.059887 };
const sample = new Repository("sample", new ApiClient("x", "d"));
const api = (data: TransitResult) =>
  new Repository("api", new ApiClient("http://api", "d", async () => new Response(JSON.stringify({ data }))));
const wrap = (ui: React.ReactElement, value: Partial<CommuteApi> = {}) => {
  const commute: CommuteApi = { workplace: WORK, pickWorkplace: vi.fn(), openRoute: vi.fn(), ...value };
  render(<CommuteProvider value={commute}>{ui}</CommuteProvider>);
  return commute;
};

describe("출퇴근 표시", () => {
  it("분을 시간으로 바꾼다", () => {
    expect(minutesLabel(38)).toBe("38분");
    expect(minutesLabel(60)).toBe("1시간");
    expect(minutesLabel(65)).toBe("1시간 5분");
  });
  it("구간 설명", () => {
    expect(
      legText({ mode: "subway", minutes: 24, distance_m: 11900, line: { name: "부산 2호선", color: null }, start_name: "해운대역", end_name: "서면역", stop_count: 15, path: null }),
    ).toBe("부산 2호선 · 해운대역 → 서면역 (15개 역)");
    expect(
      legText({ mode: "walk", minutes: 5, distance_m: 1200, line: null, start_name: null, end_name: "해운대역", stop_count: null, path: null }),
    ).toBe("걷기 1,200m · 해운대역까지");
  });
});

describe("단지 시트 출퇴근 칸", () => {
  it("공급자가 없으면 숨긴다", () => {
    render(<CommuteSection repo={sample} home={HOME} />);
    expect(screen.queryByText("출퇴근 (대중교통)")).toBeNull();
  });
  it("직장이 없으면 설정 버튼으로 이 집을 넘긴다", () => {
    const c = wrap(<CommuteSection repo={sample} home={HOME} />, { workplace: null });
    fireEvent.click(screen.getByText("직장 설정하기"));
    expect(c.pickWorkplace).toHaveBeenCalledWith(HOME);
  });
  it("직장이 있으면 가장 빠른 경로를 요약하고 누르면 자세히 연다", async () => {
    const c = wrap(<CommuteSection repo={sample} home={HOME} />);
    expect(await screen.findByText(/환승 없음/)).toBeTruthy();
    expect(screen.getByText(/샘플 경로예요/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("서면 사무실까지 경로 자세히 보기"));
    expect(c.openRoute).toHaveBeenCalledWith(HOME);
  });
  it("경로가 없으면 이유를 보여준다", async () => {
    wrap(<CommuteSection repo={api({ routes: [], unavailable_reason: "too_close" })} home={HOME} />);
    expect(await screen.findByText(/700m 안이라/)).toBeTruthy();
  });
});

describe("길찾기 화면", () => {
  it("경로 목록과 첫 경로의 구간을 펼쳐 보여주고, 퇴근으로 바꿀 수 있다", async () => {
    wrap(<CommuteScreen repo={sample} home={HOME} onBack={() => {}} />);
    expect(screen.getByText("출근 길찾기")).toBeTruthy();
    expect(await screen.findByText("가장 빠름")).toBeTruthy();
    expect(screen.getAllByText(/출발역|출발 정류장/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText("퇴근 경로로 바꾸기"));
    expect(screen.getByText("퇴근 길찾기")).toBeTruthy();
    expect(await screen.findByText("가장 빠름")).toBeTruthy();
  });
  it("직장 바꾸기는 이 집을 넘겨 직장 검색을 연다", () => {
    const c = wrap(<CommuteScreen repo={sample} home={HOME} onBack={() => {}} />);
    fireEvent.click(screen.getByLabelText("직장 바꾸기"));
    expect(c.pickWorkplace).toHaveBeenCalledWith(HOME);
  });
  it("공급처 장애는 빈 상태로 안내한다", async () => {
    wrap(<CommuteScreen repo={api({ routes: [], unavailable_reason: "source_unavailable" })} home={HOME} onBack={() => {}} />);
    expect(await screen.findByText(/잠시 불러올 수 없어요/)).toBeTruthy();
    expect(screen.getByText(/경로 정보: ODsay/)).toBeTruthy();
  });
});
