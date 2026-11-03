import { describe, expect, it } from "vitest";
import {
  SCHOOL_LEVEL,
  SCHOOL_MIN_ZOOM,
  SCHOOL_NOTICE,
  SCHOOL_SOURCE,
  schoolShortName,
} from "../src/state/school";

describe("schoolShortName", () => {
  it("끝의 초등학교·중학교·고등학교를 초·중·고로 줄인다", () => {
    expect(schoolShortName("우동초등학교")).toBe("우동초");
    expect(schoolShortName("해운대중학교")).toBe("해운대중");
    expect(schoolShortName("해운대고등학교")).toBe("해운대고");
  });

  it("줄일 접미사 바로 앞의 여자는 여로 바꾼다", () => {
    expect(schoolShortName("해운대여자고등학교")).toBe("해운대여고");
    expect(schoolShortName("해운대여자중학교")).toBe("해운대여중");
  });

  it("앞의 부산은 남긴다", () => {
    expect(schoolShortName("부산중학교")).toBe("부산중");
    expect(schoolShortName("부산여자고등학교")).toBe("부산여고");
  });

  it("접미사가 없는 이름은 그대로 둔다", () => {
    expect(schoolShortName("해마루학교")).toBe("해마루학교");
    expect(schoolShortName("부산국제외국인학교")).toBe("부산국제외국인학교");
    expect(schoolShortName("여자학교")).toBe("여자학교");
  });
});

describe("SCHOOL_LEVEL", () => {
  it("레벨별 색·모양·글자를 정의한다", () => {
    expect(SCHOOL_LEVEL.elementary).toMatchObject({
      color: "#D08A00",
      shape: "circle",
      badge: "초",
      name: "초등학교",
      legend: "초",
      rank: 5.2,
    });
    expect(SCHOOL_LEVEL.middle).toMatchObject({
      color: "#1F8A87",
      shape: "square",
      badge: "중",
      name: "중학교",
      legend: "중",
      rank: 5.1,
    });
    expect(SCHOOL_LEVEL.high).toMatchObject({
      color: "#5B3FA0",
      shape: "diamond",
      badge: "고",
      name: "고등학교",
      legend: "고",
      rank: 5,
    });
    expect(SCHOOL_LEVEL.special).toMatchObject({
      color: "#6B6B66",
      shape: "square",
      badge: "특",
      name: "특수학교",
      legend: "특수",
      rank: 5.3,
    });
    expect(SCHOOL_LEVEL.other).toMatchObject({
      color: "#6B6B66",
      shape: "circle",
      badge: "기",
      name: "기타 학교",
      legend: "기타",
      rank: 5.4,
    });
  });
});

describe("상수", () => {
  it("최소 줌과 안내·출처 문구", () => {
    expect(SCHOOL_MIN_ZOOM).toBe(14);
    expect(SCHOOL_NOTICE).toBe(
      "배정 학교(학군)가 아니라 직선거리로 가까운 학교입니다",
    );
    expect(SCHOOL_SOURCE).toBe("나이스 교육정보 개방 포털");
  });
});
