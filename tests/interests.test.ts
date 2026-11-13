import { beforeEach, describe, expect, it, vi } from "vitest";
import { SampleInterests, isDong, type ComplexInput } from "../src/api/interests";
import type { Session } from "../src/api/auth";
import { COMPLEXES } from "../src/api/fixtures";

const storage = vi.hoisted(() => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: vi.fn(async (k: string) => data.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void data.set(k, v)),
  };
});
vi.mock("@react-native-async-storage/async-storage", () => ({ default: storage }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "uuid" }));
beforeEach(() => storage.data.clear());

const session = (id: string): Session => ({
  user: { id, nickname: "부산사람", provider: "kakao", role: "buyer", marketing_push: false, created_at: "2026-11-13" },
  access_token: "a",
  refresh_token: "r",
});
const me = session("u1");
const complex = (c = COMPLEXES[0]): ComplexInput => ({
  complex_id: c.id,
  name: c.name,
  property_type: c.property_type,
  address: c.address,
  lat: c.lat,
  lng: c.lng,
});
const region = (i: number) => ({ region_code: `26350${String(10000 + i).padStart(5, "0")}`, name: `동${i}`, lat: 35, lng: 129 });

describe("관심 샘플 서버", () => {
  it("등록은 멱등이고 최신순으로 돌려준다", async () => {
    const api = new SampleInterests(0);
    await api.addComplex(me, complex());
    await api.addComplex(me, complex());
    expect(await api.listComplexes(me)).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 2));
    await api.addComplex(me, complex(COMPLEXES[1]));
    const list = await api.listComplexes(me);
    expect(list.map((c) => c.complex_id)).toEqual([COMPLEXES[1].id, COMPLEXES[0].id]);
    await api.removeComplex(me, COMPLEXES[1].id);
    expect(await api.listComplexes(me)).toHaveLength(1);
  });

  it("단지 목록에 목 거래 중 최신 거래를 붙인다", async () => {
    const api = new SampleInterests(0);
    await api.addComplex(me, complex());
    await api.addComplex(me, { ...complex(), complex_id: "no-such", name: "없는 단지" });
    const list = await api.listComplexes(me);
    const real = list.find((c) => c.complex_id === COMPLEXES[0].id)!;
    expect(real.latest?.complex_id).toBe(COMPLEXES[0].id);
    expect(real.latest?.is_cancelled).toBe(false);
    expect(list.find((c) => c.complex_id === "no-such")!.latest).toBeNull();
  });

  it("지역은 10개까지", async () => {
    const api = new SampleInterests(0);
    for (let i = 0; i < 10; i++) await api.addRegion(me, region(i));
    await expect(api.addRegion(me, region(10))).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED",
      message: "관심 지역은 10개까지예요",
    });
    await expect(api.addRegion(me, region(3))).resolves.toBeUndefined();
    expect(await api.listRegions(me)).toHaveLength(10);
  });

  it("계정마다 따로 저장하고 clear는 그 계정만 지운다", async () => {
    const api = new SampleInterests(0);
    const other = session("u2");
    await api.addComplex(me, complex());
    await api.addRegion(other, region(1));
    expect(await api.listComplexes(other)).toHaveLength(0);
    expect(await api.listRegions(me)).toHaveLength(0);
    await api.clear(me);
    expect(await api.listComplexes(me)).toHaveLength(0);
    expect(await api.listRegions(other)).toHaveLength(1);
  });

  it("법정동 코드는 10자리", () => {
    expect(isDong("2635010500")).toBe(true);
    expect(isDong("26350")).toBe(false);
  });
});
