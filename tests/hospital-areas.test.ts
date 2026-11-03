import { describe, expect, it } from "vitest";
import {
  HOSPITAL_COLOR,
  HOSPITAL_LIMIT,
  HOSPITAL_SOURCE,
  HOSPITAL_TIERS,
  HOSPITAL_TIER_LABEL,
  hospitalAreas,
  tierSummary,
} from "../src/state/hospital";
import type { Hospital } from "../src/api/types";

const LAT = 35.16;
const LNG = 129.06;

const make = (id: string, over: Partial<Hospital> = {}): Hospital => ({
  id,
  name: id,
  class_name: null,
  tier: "clinic",
  address: "",
  lat: LAT,
  lng: LNG,
  tel: null,
  homepage: null,
  doctors: 1,
  distance_m: null,
  ...over,
});

describe("병원 상수", () => {
  it("값이 고정이다", () => {
    expect(HOSPITAL_COLOR).toBe("#0E7FA8");
    expect(HOSPITAL_TIERS).toEqual(["general", "hospital", "clinic"]);
    expect(HOSPITAL_LIMIT).toBe(500);
    expect(HOSPITAL_SOURCE).toBe("건강보험심사평가원");
    expect(HOSPITAL_TIER_LABEL).toEqual({
      general: "종합병원",
      hospital: "병원",
      clinic: "의원",
    });
  });
});

describe("hospitalAreas", () => {
  it("빈 목록은 빈 배열이다", () => {
    expect(hospitalAreas([], 14)).toEqual([]);
  });

  it("줌 14(1px≈2m, 48px≈96m)에서 경도 0.0008(약 73m) 차이는 한 원, 0.0015(약 137m)이면 두 원이다", () => {
    const near = [make("a"), make("b", { lng: LNG + 0.0008 })];
    expect(hospitalAreas(near, 14)).toHaveLength(1);
    const far = [make("a"), make("b", { lng: LNG + 0.0015 })];
    expect(hospitalAreas(far, 14)).toHaveLength(2);
  });

  it("줌 16(48px≈24m)에서는 줌 14에서 묶이던 73m 떨어진 두 병원이 나뉜다", () => {
    const list = [make("a"), make("b", { lng: LNG + 0.0008 })];
    expect(hospitalAreas(list, 14)).toHaveLength(1);
    expect(hospitalAreas(list, 16)).toHaveLength(2);
  });

  it("시드는 종별 순이다. 종합병원이 의원과 묶이면 원 id와 첫 멤버가 종합병원이다", () => {
    const clinic = make("c1", { tier: "clinic", doctors: 1 });
    const general = make("g1", {
      tier: "general",
      doctors: 50,
      lng: LNG + 0.001,
    });
    const [area] = hospitalAreas([clinic, general], 14);
    expect(area.id).toBe("hospital-area:g1");
    expect(area.members.map((m) => m.id)).toEqual(["g1", "c1"]);
  });

  it("같은 종별이면 의사 수 많은 순, 같으면 id 순이고 의사 수 null은 맨 뒤다", () => {
    const list = [
      make("d", { doctors: null }),
      make("c", { doctors: 3 }),
      make("b", { doctors: 3 }),
      make("a", { doctors: 9 }),
    ];
    const [area] = hospitalAreas(list, 14);
    expect(area.members.map((m) => m.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("혼자인 병원 원의 반경은 최소 40m다", () => {
    const [area] = hospitalAreas([make("a")], 14);
    expect(area.radius_m).toBe(40);
    expect(area.lat).toBe(LAT);
    expect(area.lng).toBe(LNG);
  });

  it("두 병원은 중심이 가운데이고 반경은 각 36m + 30m 근처다(최소 40m보다 크다)", () => {
    const list = [make("a"), make("b", { lng: LNG + 0.0008 })];
    const [area] = hospitalAreas(list, 14);
    expect(area.lng).toBeCloseTo(LNG + 0.0004, 6);
    expect(area.lat).toBeCloseTo(LAT, 6);
    expect(Math.abs(area.radius_m - 66)).toBeLessThanOrEqual(2);
  });

  it("좌표가 null인 병원은 빠진다", () => {
    const list = [
      make("a"),
      make("b", { lat: null }),
      make("c", { lng: null }),
    ];
    const areas = hospitalAreas(list, 14);
    expect(areas).toHaveLength(1);
    expect(areas[0].members.map((m) => m.id)).toEqual(["a"]);
  });

  it("지도에 올리지 않는 종별(치과 등)은 무시한다", () => {
    const list = [make("a"), make("d", { tier: "dental" })];
    const areas = hospitalAreas(list, 14);
    expect(areas).toHaveLength(1);
    expect(areas[0].members.map((m) => m.id)).toEqual(["a"]);
  });

  it("한 병원은 한 원에만 들어가고, 시드 거리로만 묶어 이어서 합치지 않는다", () => {
    // a–b 73m, b–c 73m, a–c 146m. 시드 a는 b만 닿고, c는 b와 가까워도 따로 원이 된다
    const list = [
      make("a"),
      make("b", { lng: LNG + 0.0008 }),
      make("c", { lng: LNG + 0.0016 }),
    ];
    const areas = hospitalAreas(list, 14);
    expect(areas).toHaveLength(2);
    expect(areas.map((a) => a.id)).toEqual([
      "hospital-area:a",
      "hospital-area:c",
    ]);
    expect(areas.map((a) => a.members.map((m) => m.id))).toEqual([
      ["a", "b"],
      ["c"],
    ]);
  });
});

describe("tierSummary", () => {
  it("종별 수를 종합병원·병원·의원 순으로 적고 0인 종별은 뺀다", () => {
    const members = [
      make("g1", { tier: "general" }),
      make("g2", { tier: "general" }),
      ...Array.from({ length: 7 }, (_, i) => make(`c${i}`)),
    ];
    expect(tierSummary(members)).toBe("종합병원 2 · 의원 7");
    expect(tierSummary([make("h", { tier: "hospital" })])).toBe("병원 1");
    expect(tierSummary([])).toBe("");
  });
});
