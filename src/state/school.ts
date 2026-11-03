import type { SchoolLevel } from "../api/types";

// 학교 마커를 그리기 시작하는 최소 줌 레벨
export const SCHOOL_MIN_ZOOM = 14;
// 학교 시트와 목록에 붙이는 안내 문구. 배정 학교(학군)와 헷갈리지 않게 한다
export const SCHOOL_NOTICE =
  "배정 학교(학군)가 아니라 직선거리로 가까운 학교입니다";
// 배정 초등학교 안내 문구. 학구도는 법적 효력이 없고 입학생 수에 따라 분산 배정될 수 있다
export const ASSIGNMENT_NOTICE =
  "학구도 기준이며 참고용이에요. 실제 배정은 관할 교육지원청에 확인하세요";
// 학구도 출처 문구
export const ASSIGNMENT_SOURCE = "한국교육시설안전원 학구도";
// 학교 데이터 출처 문구
export const SCHOOL_SOURCE = "나이스 교육정보 개방 포털";

export type SchoolShape = "circle" | "square" | "diamond";

// 학교급별 표시 정의
// name: 시트 칩, legend: 범례, badge: 마커 도형 안 글자
// rank: 마커 겹침 우선순위(작을수록 앞). 선택된 학교는 0이고, 지도에서는 attach 경매보다 뒤에 놓는다
export const SCHOOL_LEVEL: Record<
  SchoolLevel,
  {
    color: string;
    shape: SchoolShape;
    badge: string;
    name: string;
    legend: string;
    rank: number;
  }
> = {
  elementary: {
    color: "#D08A00",
    shape: "circle",
    badge: "초",
    name: "초등학교",
    legend: "초",
    rank: 5.2,
  },
  middle: {
    color: "#1F8A87",
    shape: "square",
    badge: "중",
    name: "중학교",
    legend: "중",
    rank: 5.1,
  },
  high: {
    color: "#5B3FA0",
    shape: "diamond",
    badge: "고",
    name: "고등학교",
    legend: "고",
    rank: 5,
  },
  special: {
    color: "#6B6B66",
    shape: "square",
    badge: "특",
    name: "특수학교",
    legend: "특수",
    rank: 5.3,
  },
  other: {
    color: "#6B6B66",
    shape: "circle",
    badge: "기",
    name: "기타 학교",
    legend: "기타",
    rank: 5.4,
  },
};

const SUFFIX: Record<string, string> = {
  초등학교: "초",
  중학교: "중",
  고등학교: "고",
};

// 마커용 짧은 이름. 끝의 초등학교·중학교·고등학교를 초·중·고로 줄이고,
// 그 바로 앞의 "여자"는 "여"로 줄인다. 접미사가 없는 이름은 그대로 둔다
export function schoolShortName(name: string): string {
  return name.replace(
    /(여자)?(초등학교|중학교|고등학교)$/,
    (_, girls: string | undefined, suffix: string) =>
      `${girls ? "여" : ""}${SUFFIX[suffix]}`,
  );
}
