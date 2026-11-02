import React from "react";
import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { RoadviewStatus } from "../src/map/kakaoRuntime";

const roadview = vi.hoisted(() => ({ onStatus: null as null | ((s: RoadviewStatus) => void) }));
vi.mock("../src/roadview/Roadview", () => ({
  default: (p: { onStatus: (s: RoadviewStatus) => void }) => {
    roadview.onStatus = p.onStatus;
    return null;
  },
}));
import { RoadviewModal } from "../src/roadview/RoadviewModal";

const modal = () =>
  render(
    <RoadviewModal visible title="해운대아이파크" lat={35.15} lng={129.14} onClose={() => {}} />,
  );

it("불러오는 동안은 로딩 표시, 로드뷰가 뜨면 안내를 걷는다", () => {
  modal();
  expect(screen.getByText("해운대아이파크 로드뷰")).toBeTruthy();
  expect(screen.getByLabelText("로드뷰 불러오는 중")).toBeTruthy();
  act(() => roadview.onStatus!("ready"));
  expect(screen.queryByLabelText("로드뷰 불러오는 중")).toBeNull();
});

it("근처에 로드뷰가 없으면 로드뷰 없음 안내를 보여 준다", () => {
  modal();
  act(() => roadview.onStatus!("none"));
  expect(screen.getByText("이 위치는 로드뷰가 없어요")).toBeTruthy();
});

it("SDK를 불러오지 못하면 오류 안내를 보여 준다", () => {
  modal();
  act(() => roadview.onStatus!("error"));
  expect(screen.getByText("로드뷰를 불러올 수 없어요")).toBeTruthy();
});
