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

  it("줌 14에서 경도 0.003(약 273m) 차이는 한 원, 0.006(약 546m)이면 두 원이다", () => {
    const near = [make("a"), make("b", { lng: LNG + 0.003 })];
    expect(hospitalAreas(near, 14)).toHaveLength(1);
    const far = [make("a"), make("b", { lng: LNG + 0.006 })];
    expect(hospitalAreas(far, 14)).toHaveLength(2);
  });

  it("줌 16에서는 273m 떨어진 두 병원이 나뉜다", () => {
    const list = [make("a"), make("b", { lng: LNG + 0.003 })];
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

  it("두 병원은 중심이 가운데이고 반경은 각 136m + 30m 근처다", () => {
    const list = [make("a"), make("b", { lng: LNG + 0.003 })];
    const [area] = hospitalAreas(list, 14);
    expect(area.lng).toBeCloseTo(LNG + 0.0015, 6);
    expect(area.lat).toBeCloseTo(LAT, 6);
    expect(Math.abs(area.radius_m - 166)).toBeLessThanOrEqual(2);
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

  it("한 병원은 한 원에만 들어간다", () => {
    const list = [
      make("a"),
      make("b", { lng: LNG + 0.003 }),
      make("c", { lng: LNG + 0.006 }),
    ];
    const areas = hospitalAreas(list, 14);
    const ids = areas.flatMap((a) => a.members.map((m) => m.id));
    expect(ids.sort()).toEqual(["a", "b", "c"]);
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
