import { ApiError } from "./client";
import { TRANSACTIONS } from "./fixtures";
import type { Session } from "./auth";
import type { Property, Transaction } from "./types";
import { loadStored, store } from "../state/storage";

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
export const REGION_LIMIT = 10;
// 법정동 코드는 10자리, 시·군·구는 5자리
export const isDong = (code: string) => code.length === 10;

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
function latestOf(complexId: string): Transaction | null {
  let best: Transaction | null = null;
  for (const t of TRANSACTIONS)
    if (t.complex_id === complexId && !t.is_cancelled && (!best || t.contract_date > best.contract_date))
      best = t;
  return best;
}

// 앱 안 가짜 관심 서버. 계정마다 기기에 따로 저장한다
export class SampleInterests implements InterestsApi {
  constructor(private delay = 250) {}
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
    return newestFirst(complexes).map((c) => ({ ...c, latest: latestOf(c.complex_id) }));
  }
  async addComplex(s: Session, c: ComplexInput) {
    await wait(this.delay);
    const v = await this.load(s);
    if (v.complexes.some((x) => x.complex_id === c.complex_id)) return;
    await this.save(s, { ...v, complexes: [...v.complexes, { ...c, created_at: new Date().toISOString() }] });
  }
  async removeComplex(s: Session, complexId: string) {
    await wait(this.delay);
    const v = await this.load(s);
    await this.save(s, { ...v, complexes: v.complexes.filter((x) => x.complex_id !== complexId) });
  }
  async listRegions(s: Session) {
    await wait(this.delay);
    return newestFirst((await this.load(s)).regions);
  }
  async addRegion(s: Session, r: RegionInput) {
    await wait(this.delay);
    const v = await this.load(s);
    if (v.regions.some((x) => x.region_code === r.region_code)) return;
    if (v.regions.length >= REGION_LIMIT)
      throw new ApiError(`관심 지역은 ${REGION_LIMIT}개까지예요`, "LIMIT_EXCEEDED");
    await this.save(s, { ...v, regions: [...v.regions, { ...r, created_at: new Date().toISOString() }] });
  }
  async removeRegion(s: Session, regionCode: string) {
    await wait(this.delay);
    const v = await this.load(s);
    await this.save(s, { ...v, regions: v.regions.filter((x) => x.region_code !== regionCode) });
  }
  async clear(s: Session) {
    await wait(this.delay);
    await this.save(s, { complexes: [], regions: [] });
  }
}
