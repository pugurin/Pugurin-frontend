import { ApiError } from "./client";
import { TRANSACTIONS } from "./fixtures";
import type { Session } from "./auth";
import type { Property, Transaction } from "./types";
import { loadStored, store } from "../state/storage";
import { REGION_LIMIT, isDong } from "../state/interests";

// 관심 단지(F-INT-01)·관심 지역(F-INT-02). API 명세 §10 /interests/complexes·/interests/regions 모양을 따른다.
// 백엔드 API가 아직 없어 지금은 SampleInterests(앱 안 가짜 서버)만 쓴다
export type ComplexInterest = {
  complex_id: string;
  name: string;
  property_type: Property;
  address: string;
  lat: number;
  lng: number;
  created_at: string;
  // 단지별 최근 거래. 거래가 없으면 null
  latest: Transaction | null;
};
// 관심 지역은 법정동 단위다
export type RegionInterest = {
  region_code: string;
  name: string;
  lat: number;
  lng: number;
  created_at: string;
};
export type ComplexInput = Omit<ComplexInterest, "created_at" | "latest">;
export type RegionInput = Omit<RegionInterest, "created_at">;
export { REGION_LIMIT, isDong };

export interface InterestsApi {
  listComplexes(s: Session): Promise<ComplexInterest[]>;
  addComplex(s: Session, c: ComplexInput): Promise<void>;
  removeComplex(s: Session, complexId: string): Promise<void>;
  listRegions(s: Session): Promise<RegionInterest[]>;
  addRegion(s: Session, r: RegionInput): Promise<void>;
  removeRegion(s: Session, regionCode: string): Promise<void>;
  // 탈퇴하면 그 계정 관심 목록을 지운다
  clear(s: Session): Promise<void>;
}

type Saved = {
  complexes: Omit<ComplexInterest, "latest">[];
  regions: RegionInterest[];
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newestFirst = <T extends { created_at: string }>(list: T[]) =>
  [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
// 단지별 최근 거래. 단지 시트 첫 화면처럼 매매를 먼저 고르고, 매매가 없으면 전월세 중 최신
function latestOf(complexId: string): Transaction | null {
  const list = TRANSACTIONS.filter(
    (t) => t.complex_id === complexId && !t.is_cancelled,
  );
  const newest = (xs: Transaction[]) =>
    xs.reduce<Transaction | null>(
      (best, t) => (!best || t.contract_date > best.contract_date ? t : best),
      null,
    );
  return newest(list.filter((t) => t.deal_type === "sale")) ?? newest(list);
}

// 앱 안 가짜 관심 서버. 계정마다 기기에 따로 저장한다
export class SampleInterests implements InterestsApi {
  constructor(private delay = 250) {}
  // 계정별 쓰기 순서. 읽고-고쳐-쓰기가 겹치면 먼저 쓴 값을 덮어쓰므로 하나씩 처리한다
  private queue = new Map<string, Promise<unknown>>();
  private update(s: Session, change: (v: Saved) => Saved | null) {
    const key = this.key(s);
    const next = (this.queue.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        await wait(this.delay);
        const v = change(await this.load(s));
        if (v) await this.save(s, v);
      });
    this.queue.set(key, next);
    return next;
  }
  private key(s: Session) {
    return `sample_interests.${s.user.id}`;
  }
  private load(s: Session) {
    return loadStored<Saved>(this.key(s), { complexes: [], regions: [] });
  }
  private save(s: Session, v: Saved) {
    return store(this.key(s), v);
  }
  async listComplexes(s: Session) {
    await wait(this.delay);
    const { complexes } = await this.load(s);
    return newestFirst(complexes).map((c) => ({
      ...c,
      latest: latestOf(c.complex_id),
    }));
  }
  addComplex(s: Session, c: ComplexInput) {
    return this.update(s, (v) =>
      v.complexes.some((x) => x.complex_id === c.complex_id)
        ? null
        : {
            ...v,
            complexes: [
              ...v.complexes,
              { ...c, created_at: new Date().toISOString() },
            ],
          },
    );
  }
  removeComplex(s: Session, complexId: string) {
    return this.update(s, (v) => ({
      ...v,
      complexes: v.complexes.filter((x) => x.complex_id !== complexId),
    }));
  }
  async listRegions(s: Session) {
    await wait(this.delay);
    return newestFirst((await this.load(s)).regions);
  }
  addRegion(s: Session, r: RegionInput) {
    return this.update(s, (v) => {
      if (v.regions.some((x) => x.region_code === r.region_code)) return null;
      if (v.regions.length >= REGION_LIMIT)
        throw new ApiError(
          `관심 지역은 ${REGION_LIMIT}개까지예요`,
          "LIMIT_EXCEEDED",
        );
      return {
        ...v,
        regions: [...v.regions, { ...r, created_at: new Date().toISOString() }],
      };
    });
  }
  removeRegion(s: Session, regionCode: string) {
    return this.update(s, (v) => ({
      ...v,
      regions: v.regions.filter((x) => x.region_code !== regionCode),
    }));
  }
  clear(s: Session) {
    return this.update(s, () => ({ complexes: [], regions: [] }));
  }
}
