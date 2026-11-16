import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError } from "./client";
import type { Session } from "./auth";
import type { Mode, Repository } from "./repository";
import type { Deal, Property, Transaction } from "./types";
import { DEFAULT_FILTERS } from "../state/market";
import { REGION_LIMIT, isDong } from "../state/interests";

// 관심 단지(F-INT-01)·관심 지역(F-INT-02). API 명세 §10 /interests/complexes·/interests/regions 모양을 따른다.
// 백엔드 API가 아직 없어 지금은 샘플 로그인(EXPO_PUBLIC_AUTH_MODE=sample)일 때만 SampleInterests(앱 안 가짜 서버)를 쓴다
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

// 저장 모양 버전. 모양을 바꾸면 올리고, 모르는 버전은 덮어쓰지 않고 오류로 올린다
const SAVED_VERSION = 1;
type Saved = {
  v: typeof SAVED_VERSION;
  complexes: Omit<ComplexInterest, "latest">[];
  regions: RegionInterest[];
};
const SCOPES: Mode[] = ["sample", "api"];
const EMPTY: Saved = { v: SAVED_VERSION, complexes: [], regions: [] };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newestFirst = <T extends { created_at: string }>(list: T[]) =>
  [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
const readFailed = () =>
  new ApiError("관심 목록을 불러오지 못했어요", "STORAGE_ERROR");

// 단지별 최근 거래를 찾는 함수. App이 지금 데이터 모드의 repo로 만들어 넘긴다
export type LatestOf = (
  c: Pick<ComplexInput, "complex_id" | "property_type">,
) => Promise<Transaction | null>;

// 단지 시트 첫 화면처럼 매매를 먼저 고르고, 매매가 없으면 전세·월세 중 최신
export async function latestTransaction(
  repo: Pick<Repository, "transactions">,
  c: Pick<ComplexInput, "complex_id" | "property_type">,
): Promise<Transaction | null> {
  const first = (deal_type: Deal) =>
    repo
      .transactions(
        { ...DEFAULT_FILTERS, property_type: c.property_type, deal_type },
        { complexId: c.complex_id, page: 1 },
      )
      .then((r) => r.data[0] ?? null);
  const sale = await first("sale");
  if (sale) return sale;
  const rents = await Promise.all([first("jeonse"), first("monthly")]);
  return rents.reduce<Transaction | null>(
    (best, t) => (t && (!best || t.contract_date > best.contract_date) ? t : best),
    null,
  );
}

// 앱 안 가짜 관심 서버. 계정·데이터 모드마다 기기에 따로 저장한다.
// 샘플 모드 단지 id와 백엔드 uuid는 서로 맞지 않아서 모드(scope)를 저장 키에 넣는다.
// 다른 저장값(loadStored·store)과 달리 읽기·쓰기 오류를 숨기지 않는다.
// 숨기면 저장이 안 됐는데도 "담았어요"가 뜨고, 읽기 실패 뒤 쓰기가 기존 관심을 덮어쓴다
export class SampleInterests implements InterestsApi {
  constructor(
    private opts: { scope: Mode; latestOf: LatestOf; delay?: number },
  ) {}
  private get delay() {
    return this.opts.delay ?? 250;
  }
  // 계정별 쓰기 순서. 읽고-고쳐-쓰기가 겹치면 먼저 쓴 값을 덮어쓰므로 하나씩 처리한다
  private queue = new Map<string, Promise<unknown>>();
  private update(s: Session, change: (v: Saved) => Saved | null) {
    return this.enqueue(s, async () => {
      const v = change(await this.load(s));
      if (v) await this.save(s, v);
    });
  }
  private enqueue(s: Session, job: () => Promise<void>) {
    const key = this.key(s);
    const next = (this.queue.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        await wait(this.delay);
        await job();
      });
    this.queue.set(key, next);
    return next;
  }
  private key(s: Session, scope: Mode = this.opts.scope) {
    return `pugurin.sample_interests.${scope}.${s.user.id}`;
  }
  private async load(s: Session): Promise<Saved> {
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(this.key(s));
    } catch {
      throw readFailed();
    }
    if (!raw) return EMPTY;
    let v: Saved;
    try {
      v = JSON.parse(raw);
    } catch {
      throw readFailed();
    }
    if (v?.v !== SAVED_VERSION) throw readFailed();
    return v;
  }
  private async save(s: Session, v: Saved) {
    try {
      await AsyncStorage.setItem(this.key(s), JSON.stringify(v));
    } catch {
      throw new ApiError("관심 목록을 저장하지 못했어요", "STORAGE_ERROR");
    }
  }
  async listComplexes(s: Session) {
    await wait(this.delay);
    const { complexes } = await this.load(s);
    // 최근 거래를 못 불러와도 목록은 보여 준다
    return Promise.all(
      newestFirst(complexes).map(async (c) => ({
        ...c,
        latest: await this.opts.latestOf(c).catch(() => null),
      })),
    );
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
  // 탈퇴하면 두 데이터 모드에 담은 것을 모두 지운다. 읽기에 실패한 저장값도 지운다
  clear(s: Session) {
    return this.enqueue(s, async () => {
      try {
        await AsyncStorage.multiRemove(SCOPES.map((m) => this.key(s, m)));
      } catch {
        throw new ApiError("관심 목록을 지우지 못했어요", "STORAGE_ERROR");
      }
    });
  }
}
