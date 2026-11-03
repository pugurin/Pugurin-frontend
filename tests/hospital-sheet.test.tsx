import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Linking } from "react-native";
import { HospitalAreaContent } from "../src/screens/HospitalAreaContent";
import { HOSPITALS, HOSPITAL_META } from "../src/api/fixtures";
import type { HospitalArea } from "../src/state/hospital";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const pick = (id: string) => HOSPITALS.find((h) => h.id === id)!;
const members = [
  pick("h-seomyeon-general"),
  pick("h-seomyeon-hospital"),
  pick("h-seomyeon-clinic"),
];
const area: HospitalArea = {
  id: "hospital-area:h-seomyeon-general",
  lat: 35.156,
  lng: 129.061,
  radius_m: 300,
  members,
};

describe("병원 시트", () => {
  it("제목·종별 줄·병원별 종별과 의사 수·출처 기준일을 보여준다", () => {
    render(<HospitalAreaContent area={area} meta={HOSPITAL_META} />);
    expect(screen.getByText("병원 3곳")).toBeTruthy();
    expect(screen.getByText("종합병원 1 · 병원 1 · 의원 1")).toBeTruthy();
    expect(screen.getByText("부산서면종합병원")).toBeTruthy();
    expect(screen.getByText("종합병원 · 의사 84명")).toBeTruthy();
    expect(screen.getByText("병원 · 의사 12명")).toBeTruthy();
    expect(screen.getByText("의원 · 의사 2명")).toBeTruthy();
    expect(
      screen.getByText("출처: 건강보험심사평가원 · 기준일 2026.11.02"),
    ).toBeTruthy();
  });

  it("의사 수나 종별이 null이면 있는 것만 보여준다", () => {
    const a = {
      ...area,
      members: [
        { ...members[0], doctors: null },
        { ...members[1], class_name: null },
      ],
    };
    render(<HospitalAreaContent area={a} />);
    expect(screen.getByText("종합병원")).toBeTruthy();
    expect(screen.getByText("의사 12명")).toBeTruthy();
    expect(screen.getByText("출처: 건강보험심사평가원")).toBeTruthy();
  });

  it("줄을 누르면 주소(부산광역시 뺌)·전화·홈페이지가 펼쳐지고 다시 누르면 접힌다", () => {
    const open = vi.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    render(<HospitalAreaContent area={area} meta={HOSPITAL_META} />);
    expect(screen.queryByText("부산진구 서면로 68")).toBeNull();
    const row = screen.getByRole("button", { name: /부산서면종합병원/ });
    expect(row.getAttribute("aria-expanded")).not.toBe("true");
    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("부산진구 서면로 68")).toBeTruthy();
    fireEvent.click(screen.getByText("전화"));
    expect(open).toHaveBeenCalledWith("tel:051-000-1001");
    fireEvent.click(screen.getByText("홈페이지"));
    expect(open).toHaveBeenCalledWith("https://seomyeon-hospital.example.kr");
    fireEvent.click(row);
    expect(screen.queryByText("부산진구 서면로 68")).toBeNull();
    expect(row.getAttribute("aria-expanded")).not.toBe("true");
  });

  it("전화·홈페이지가 없으면 버튼을 숨기고, 한 번에 한 줄만 펼친다", () => {
    render(<HospitalAreaContent area={area} meta={HOSPITAL_META} />);
    fireEvent.click(screen.getByRole("button", { name: /서면연합병원/ }));
    expect(screen.getByText("부산진구 중앙대로 702")).toBeTruthy();
    expect(screen.getByText("전화")).toBeTruthy();
    expect(screen.queryByText("홈페이지")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /전포내과의원/ }));
    expect(screen.queryByText("부산진구 중앙대로 702")).toBeNull();
    expect(screen.getByText("전포대로 199", { exact: false })).toBeTruthy();
  });
});
