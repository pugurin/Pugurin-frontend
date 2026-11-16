import { beforeEach, describe, expect, it, vi } from "vitest";
import { SampleInterests, isDong, latestTransaction, type ComplexInput, type LatestOf } from "../src/api/interests";
import type { Transaction } from "../src/api/types";
import type { Session } from "../src/api/auth";
import { COMPLEXES } from "../src/api/fixtures";

const storage = vi.hoisted(() => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: vi.fn(async (k: string) => data.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void data.set(k, v)),
    multiRemove: vi.fn(async (ks: string[]) => ks.forEach((k) => data.delete(k))),
  };
});
vi.mock("@react-native-async-storage/async-storage", () => ({ default: storage }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "uuid" }));
beforeEach(() => {
  storage.data.clear();
  storage.getItem.mockImplementation(async (k: string) => storage.data.get(k) ?? null);
});
const sample = (latestOf: LatestOf = async () => null, scope: "sample" | "api" = "sample") =>
  new SampleInterests({ scope, latestOf, delay: 0 });

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
    const api = sample();
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

  it("단지 목록의 최근 거래는 넘겨받은 조회 함수(지금 repo)로 붙이고, 실패하면 없음으로 둔다", async () => {
    const tx = { id: "t1", complex_id: "uuid-1" } as Transaction;
    const latestOf = vi.fn<LatestOf>(async (c) => {
      if (c.complex_id === "broken") throw new Error("500");
      return c.complex_id === "uuid-1" ? tx : null;
    });
    const api = sample(latestOf, "api");
    await api.addComplex(me, { ...complex(), complex_id: "uuid-1" });
    await api.addComplex(me, { ...complex(), complex_id: "broken" });
    const list = await api.listComplexes(me);
    expect(list.find((c) => c.complex_id === "uuid-1")!.latest).toBe(tx);
    expect(list.find((c) => c.complex_id === "broken")!.latest).toBeNull();
    expect(latestOf).toHaveBeenCalledWith(expect.objectContaining({ complex_id: "uuid-1", property_type: "apartment" }));
  });

  it("최근 거래는 매매를 먼저, 없으면 전세·월세 중 최신을 고른다", async () => {
    const tx = (deal: string, date: string) => ({ deal_type: deal, contract_date: date }) as Transaction;
    const repo = (data: Record<string, Transaction[]>) => ({
      transactions: vi.fn(async (f: any, o: any) => {
        expect(o.complexId).toBe("c1");
        return { data: data[f.deal_type] ?? [] } as any;
      }),
    });
    const c = { complex_id: "c1", property_type: "apartment" as const };
    expect(await latestTransaction(repo({ sale: [tx("sale", "2026-01-01")], jeonse: [tx("jeonse", "2026-09-01")] }), c)).toMatchObject({ deal_type: "sale" });
    expect(await latestTransaction(repo({ jeonse: [tx("jeonse", "2026-03-01")], monthly: [tx("monthly", "2026-05-01")] }), c)).toMatchObject({ deal_type: "monthly" });
    expect(await latestTransaction(repo({}), c)).toBeNull();
  });

  it("데이터 모드마다 따로 저장한다(샘플 단지 id와 백엔드 uuid가 섞이지 않게)", async () => {
    await sample(undefined, "sample").addComplex(me, complex());
    expect(await sample(undefined, "api").listComplexes(me)).toHaveLength(0);
    expect(await sample(undefined, "sample").listComplexes(me)).toHaveLength(1);
  });

  it("저장값을 읽지 못하거나 모르는 모양이면 오류로 올리고 덮어쓰지 않는다", async () => {
    const api = sample();
    await api.addComplex(me, complex());
    const key = [...storage.data.keys()][0];
    for (const broken of ["{oops", JSON.stringify({ complexes: [], regions: [] })]) {
      storage.data.set(key, broken);
      await expect(api.listComplexes(me)).rejects.toMatchObject({ message: "관심 목록을 불러오지 못했어요" });
      await expect(api.addComplex(me, complex(COMPLEXES[1]))).rejects.toMatchObject({ code: "STORAGE_ERROR" });
      expect(storage.data.get(key)).toBe(broken);
    }
    storage.getItem.mockRejectedValueOnce(new Error("io"));
    await expect(api.listRegions(me)).rejects.toMatchObject({ code: "STORAGE_ERROR" });
  });

  it("쓰기에 실패하면 오류로 올린다", async () => {
    storage.setItem.mockRejectedValueOnce(new Error("disk full"));
    await expect(sample().addComplex(me, complex())).rejects.toMatchObject({ message: "관심 목록을 저장하지 못했어요" });
  });

  it("지역은 10개까지", async () => {
    const api = sample();
    for (let i = 0; i < 10; i++) await api.addRegion(me, region(i));
    await expect(api.addRegion(me, region(10))).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED",
      message: "관심 지역은 10개까지예요",
    });
    await expect(api.addRegion(me, region(3))).resolves.toBeUndefined();
    expect(await api.listRegions(me)).toHaveLength(10);
  });

  it("계정마다 따로 저장하고 clear는 그 계정만 지운다", async () => {
    const api = sample();
    const other = session("u2");
    await api.addComplex(me, complex());
    await api.addRegion(other, region(1));
    expect(await api.listComplexes(other)).toHaveLength(0);
    expect(await api.listRegions(me)).toHaveLength(0);
    await api.clear(me);
    expect(await api.listComplexes(me)).toHaveLength(0);
    expect(await api.listRegions(other)).toHaveLength(1);
  });

  it("탈퇴(clear)하면 두 데이터 모드 모두, 읽지 못하는 저장값까지 지운다", async () => {
    await sample(undefined, "sample").addComplex(me, complex());
    await sample(undefined, "api").addComplex(me, complex());
    const keys = [...storage.data.keys()];
    storage.data.set(keys[0], "{oops");
    await sample(undefined, "api").clear(me);
    expect(storage.data.size).toBe(0);
  });

  it("동시에 들어온 요청도 하나씩 처리해 서로 덮어쓰지 않는다", async () => {
    const api = sample();
    for (let i = 0; i < 9; i++) await api.addRegion(me, region(i));
    // 실제 기기처럼 읽기가 느리면 두 요청이 같은 옛 값을 읽는다
    storage.getItem.mockImplementation(
      (k: string) => {
        const v = storage.data.get(k) ?? null;
        return new Promise((r) => setTimeout(() => r(v), 5));
      },
    );
    await Promise.all([api.addComplex(me, complex()), api.addComplex(me, complex(COMPLEXES[1]))]);
    expect(await api.listComplexes(me)).toHaveLength(2);
    // 9개에서 두 개가 동시에 오면 하나만 들어가고 하나는 10개 제한에 걸린다
    const r = await Promise.allSettled([api.addRegion(me, region(20)), api.addRegion(me, region(21))]);
    expect(r.map((x) => x.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(await api.listRegions(me)).toHaveLength(10);
  });

  it("법정동 코드는 10자리", () => {
    expect(isDong("2635010500")).toBe(true);
    expect(isDong("26350")).toBe(false);
  });
});
