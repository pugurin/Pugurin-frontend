import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Linking } from "react-native";
import { SchoolContent } from "../src/screens/SchoolContent";
import { SCHOOLS, SCHOOL_META } from "../src/api/fixtures";
import type { School } from "../src/api/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const girlsHigh = SCHOOLS.find((x) => x.id === "s-haeundae-girls-high")!;

describe("학교 시트", () => {
  it("레벨 칩·설립·남녀공학·원래 이름·주소·전화·홈페이지·개교일·안내·출처를 보여준다", () => {
    // 백엔드 data_as_of는 날짜시간으로 온다
    const meta = {
      ...SCHOOL_META,
      data_as_of: "2026-11-02T14:03:11.123456+09:00",
      school_notice: "서버가 준 학교 안내 문구",
    };
    render(<SchoolContent school={girlsHigh} meta={meta} />);
    const level = screen.getByText("고등학교");
    // 레벨 색(#5B3FA0) 칩
    expect(getComputedStyle(level.parentElement!).backgroundColor).toBe(
      "rgb(91, 63, 160)",
    );
    expect(screen.getByText("사립")).toBeTruthy();
    expect(screen.getByText("여")).toBeTruthy();
    expect(screen.getByText("해운대여자고등학교")).toBeTruthy();
    expect(screen.getByText("해운대구 좌동순환로 100")).toBeTruthy();
    expect(screen.queryByText(/부산광역시/)).toBeNull();
    expect(screen.getByText("051-000-0004")).toBeTruthy();
    expect(screen.getByText("홈페이지 열기 ↗")).toBeTruthy();
    expect(screen.getByText("1983.03.01 개교")).toBeTruthy();
    expect(screen.getByText("서버가 준 학교 안내 문구")).toBeTruthy();
    // 출처 배열이어도 학교 출처만 쓰고, 기준일은 앞 10글자를 점으로 이어 쓴다
    expect(
      screen.getByText("출처: 나이스 교육정보 개방 포털 · 기준일 2026.11.02"),
    ).toBeTruthy();
    expect(screen.queryByText(/건강보험심사평가원/)).toBeNull();
  });

  it("안내 박스는 제목·주소 바로 뒤, 개교일·홈페이지 앞에 놓인다(작은 화면 peek에서도 보이게)", () => {
    render(<SchoolContent school={girlsHigh} meta={SCHOOL_META} />);
    const order = [
      "해운대구 좌동순환로 100",
      "배정 학교(학군)가 아니라 직선거리로 가까운 학교입니다",
      "1983.03.01 개교",
      "홈페이지 열기 ↗",
    ].map((t) => screen.getByText(t));
    for (let i = 1; i < order.length; i++)
      expect(
        order[i - 1].compareDocumentPosition(order[i]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
  });

  it("주소 형식이 없는 홈페이지는 http://를 붙이고, http·https가 아닌 주소는 버튼을 숨긴다", () => {
    const open = vi.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    render(
      <SchoolContent school={{ ...girlsHigh, homepage: "haeundae.es.kr" }} />,
    );
    fireEvent.click(screen.getByText("홈페이지 열기 ↗"));
    expect(open).toHaveBeenCalledWith("http://haeundae.es.kr");
    cleanup();
    render(
      <SchoolContent
        school={{ ...girlsHigh, homepage: "HTTP://haeundae.es.kr" }}
      />,
    );
    fireEvent.click(screen.getByText("홈페이지 열기 ↗"));
    expect(open).toHaveBeenLastCalledWith("HTTP://haeundae.es.kr");
    cleanup();
    for (const bad of ["javascript:alert(1)", "ftp://haeundae.es.kr"]) {
      render(<SchoolContent school={{ ...girlsHigh, homepage: bad }} />);
      expect(screen.queryByText("홈페이지 열기 ↗")).toBeNull();
      cleanup();
    }
  });

  it("홈페이지 버튼은 homepage를 연다", () => {
    const open = vi.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    render(<SchoolContent school={girlsHigh} meta={SCHOOL_META} />);
    fireEvent.click(screen.getByText("홈페이지 열기 ↗"));
    expect(open).toHaveBeenCalledWith("https://haeundaegirls.hs.kr");
  });

  it("웹에서는 전화번호를 글자로만 보여준다", () => {
    const open = vi.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    render(<SchoolContent school={girlsHigh} meta={SCHOOL_META} />);
    fireEvent.click(screen.getByText("051-000-0004"));
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /051-000-0004/ })).toBeNull();
  });

  it("비어 있는 전화·홈페이지·설립·남녀공학·개교일은 줄과 칩을 숨긴다", () => {
    const bare: School = {
      ...girlsHigh,
      tel: null,
      homepage: null,
      foundation: null,
      coed: null,
      opened_on: null,
    };
    render(<SchoolContent school={bare} meta={SCHOOL_META} />);
    expect(screen.getByText("고등학교")).toBeTruthy();
    expect(screen.queryByText("사립")).toBeNull();
    expect(screen.queryByText("여")).toBeNull();
    expect(screen.queryByText(/051-/)).toBeNull();
    expect(screen.queryByText("홈페이지 열기 ↗")).toBeNull();
    expect(screen.queryByText(/개교/)).toBeNull();
  });

  it("meta가 없으면 기본 안내 문구와 출처(기준일 없이)를 쓴다", () => {
    render(<SchoolContent school={girlsHigh} />);
    expect(
      screen.getByText("배정 학교(학군)가 아니라 직선거리로 가까운 학교입니다"),
    ).toBeTruthy();
    expect(screen.getByText("출처: 나이스 교육정보 개방 포털")).toBeTruthy();
  });

  it("기타 학교 레벨은 '기타 학교' 칩을 쓴다", () => {
    render(<SchoolContent school={{ ...girlsHigh, level: "other" }} />);
    expect(screen.getByText("기타 학교")).toBeTruthy();
  });
});
