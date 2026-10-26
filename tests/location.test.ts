import { beforeEach, describe, expect, it, vi } from "vitest";
const perm = vi.hoisted(() => ({ status: "undetermined" as string, fail: false }));
const saved = vi.hoisted(() => new Map<string, string>());
vi.mock("expo-location", () => ({
  getForegroundPermissionsAsync: async () => {
    if (perm.fail) throw new Error("no location");
    return { status: perm.status };
  },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => saved.get(k) ?? null,
    setItem: async (k: string, v: string) => void saved.set(k, v),
  },
}));
import {
  initialLocationStart,
  locationStart,
  markLocationAsked,
} from "../src/state/location";
import {
  userLocationFeatures,
  USER_DOT_LAYER,
  USER_HALO_LAYER,
} from "../src/map/userLocation";

describe("첫 실행 위치 권한 (#92)", () => {
  beforeEach(() => {
    saved.clear();
    perm.status = "undetermined";
    perm.fail = false;
  });
  it("이미 허용했으면 안내 없이 바로 내 위치로 간다", () => {
    expect(locationStart("granted", false)).toBe("locate");
    expect(locationStart("granted", true)).toBe("locate");
  });
  it("안내한 적이 없으면 모달을 띄우고, 한 번 답하면 다시 묻지 않는다", () => {
    expect(locationStart("undetermined", false)).toBe("ask");
    expect(locationStart("denied", false)).toBe("ask");
    expect(locationStart("undetermined", true)).toBe("none");
    expect(locationStart("denied", true)).toBe("none");
  });
  it("모달에 답한 기록을 기기에 저장해 다음 실행에 쓴다", async () => {
    expect(await initialLocationStart()).toBe("ask");
    await markLocationAsked();
    expect(await initialLocationStart()).toBe("none");
    perm.status = "granted";
    expect(await initialLocationStart()).toBe("locate");
  });
  it("위치 기능을 쓸 수 없는 환경이면 기본 위치 그대로 둔다", async () => {
    perm.fail = true;
    expect(await initialLocationStart()).toBe("none");
  });
});

describe("내 위치 마커", () => {
  it("확인한 좌표에 점 하나를 표시한다", () => {
    expect(userLocationFeatures({ lat: 35.16, lng: 129.16 }).features).toEqual([
      {
        type: "Feature",
        properties: { kind: "user" },
        geometry: { type: "Point", coordinates: [129.16, 35.16] },
      },
    ]);
  });
  it("위치가 없거나 잘못되면 표시하지 않는다", () => {
    for (const loc of [null, undefined, { lat: NaN, lng: 129 }, { lat: 91, lng: 129 }])
      expect(userLocationFeatures(loc).features).toEqual([]);
  });
  it("거래 마커와 구분되는 파란 점과 옅은 원으로 그린다", () => {
    expect(USER_DOT_LAYER).toMatchObject({ type: "circle", paint: { "circle-color": "#1A73E8", "circle-stroke-color": "#FFFFFF" } });
    expect(USER_HALO_LAYER).toMatchObject({ type: "circle", paint: { "circle-opacity": 0.16 } });
  });
});
