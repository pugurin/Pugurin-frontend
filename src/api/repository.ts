import { ApiClient, ApiError } from "./client";
import { HOSPITAL_TIERS } from "../state/hospital";
import {
  REDEVELOPMENT_LIMIT,
  cleanRedevelopment,
} from "../state/redevelopment";
import type {
  Analysis,
  Redevelopment,
  RedevelopmentStage,
  RedevelopmentZone,
  Auction,
  AuctionDetail,
  AuctionInterest,
  AppNotification,
  InterestReport,
  NotificationMeta,
  ReportSetting,
  ComplexInterest,
  InterestIds,
  InterestKind,
  AuctionQuery,
  BBox,
  Complex,
  Envelope,
  Filters,
  Hospital,
  MarkerData,
  Nearby,
  Parcel,
  School,
  SchoolZone,
  SearchResult,
  Sort,
  Stats,
  Term,
  Transaction,
} from "./types";
import {
  SCHOOL_ZONES,
  SCHOOL_ZONE_META,
  REDEVELOPMENTS,
  REDEVELOPMENT_META,
  REDEVELOPMENT_ZONES,
  REDEVELOPMENT_ZONE_META,
  AUCTIONS,
  AUCTION_META,
  COMPLEXES,
  HOSPITALS,
  HOSPITAL_META,
  SAMPLE_META,
  SCHOOLS,
  SCHOOL_META,
  SAMPLE_REPORTS,
  SAMPLE_STATS,
  TERMS,
  TRANSACTIONS,
  sampleMarkers,
  sampleSearch,
  sampleTransactions,
} from "./fixtures";
import { queryForFilters, TREND_MONTHS } from "../state/market";
import {
  sampleTransit,
  transitQuery,
  type LatLng,
  type TransitResult,
} from "./transit";
import { LOCAL_SCHOOL_ZONES, LOCAL_ZONE_META } from "./schoolZonesLocal";
export type Mode = "api" | "sample";
// 학교 이름 검색에 쓰는 부산 범위(min_lng, min_lat, max_lng, max_lat)
const BUSAN_BBOX: BBox = [128.75, 34.85, 129.35, 35.4];
// 학교 검색 결과 최대 개수
const SCHOOL_SEARCH_LIMIT = 10;
// 통합 검색이 끝난 뒤 학교 목록을 더 기다리는 시간(ms). 늦으면 학교 없이 결과를 준다
export const SCHOOL_SEARCH_WAIT_MS = 800;
// 서버가 종류별로 받아 주는 관심 개수 상한. 넘으면 409 CONFLICT
export const INTEREST_LIMIT = 200;
// 알림 목록 한 번에 받는 개수
export const NOTIFICATION_PAGE_SIZE = 20;
// 샘플 관심 목록. 앱을 켜는 동안 한 벌이고(계정을 가리지 않는다), 다시 켜면 비어 있다.
// 샘플 데이터 모드와, 샘플 로그인으로 실제 데이터를 보는 미리보기(interestMode "sample")가 쓴다
const sampleInterests: Record<InterestKind, Map<string, string>> = {
  complex: new Map(),
  auction: new Map(),
};
// 샘플 모드에서 읽음 처리한 알림 id(앱을 켜는 동안만 유지). 처음엔 두 번째 리포트만 읽은 상태다
const sampleRead = new Map<string, string>(
  SAMPLE_REPORTS.filter((n) => n.read_at).map((n) => [n.id, n.read_at!]),
);
const sampleNotification = (n: InterestReport): InterestReport => ({
  ...n,
  read_at: sampleRead.get(n.id) ?? null,
});
// 샘플 모드의 주간 리포트 받기 설정(앱을 켜는 동안만 유지). 서버처럼 기본은 받는다
const sampleReportSetting: ReportSetting = { weekly_report: true };
// 관심 목록·알림 API는 로그인이 필요해 토큰을 붙인다
const AUTH = { auth: true };
const newestFirst = (m: Map<string, string>) =>
  [...m].sort((a, b) => b[1].localeCompare(a[1]));
export class Repository {
  constructor(
    public mode: Mode,
    private client: ApiClient,
    // 관심 목록을 어디에 둘지. 샘플 로그인(미리보기)이면 데이터가 실제여도 앱 안에 둔다.
    // 가짜 토큰을 실제 서버에 보내면 401만 나기 때문이다
    private interestMode: Mode = mode,
  ) {}
  // 미리보기(데이터는 실제 서버, 로그인·알림은 앱 안 샘플)라 리포트가 샘플인지.
  // 이때 리포트 속 단지 id는 실제 서버에 없어 단지를 열 수 없다. 전체 샘플 모드는 단지도 샘플 데이터에 있다
  // 리포트가 샘플 데이터인지(미리보기든 전체 샘플 모드든). 샘플 표시를 다는 기준이다
  get reportSample() {
    return this.interestMode === "sample";
  }
  get reportPreview() {
    return this.interestMode === "sample" && this.mode !== "sample";
  }
  markers(f: Filters, b: BBox, z: number, signal?: AbortSignal) {
    return this.mode === "sample"
      ? Promise.resolve(sampleMarkers(f, b, z))
      : this.client.get<MarkerData>(
          `/map/markers?${queryForFilters(f, b, z)}`,
          signal,
        );
  }
  complex(id: string, signal?: AbortSignal): Promise<Envelope<Complex>> {
    return this.mode === "sample"
      ? Promise.resolve({ data: COMPLEXES.find((c) => c.id === id)! })
      : this.client.get<Complex>(
          `/complexes/${encodeURIComponent(id)}`,
          signal,
        );
  }
  transactions(
    f: Filters,
    opts: {
      complexId?: string;
      region?: string;
      bbox?: BBox;
      sort?: Sort;
      cancelled?: boolean;
      page?: number;
      // 기본 20. 단지 거래 API는 최대 100
      pageSize?: number;
      area?: number;
    },
    signal?: AbortSignal,
  ): Promise<Envelope<Transaction[]>> {
    if (this.mode === "sample")
      return Promise.resolve(sampleTransactions(f, opts));
    // 단지 거래이력 API는 지도 가격/기간 필터를 받지 않는다. 명세에 있는 필드만 보낸다.
    const q = opts.complexId
      ? new URLSearchParams({
          deal_type: f.deal_type,
          exclude_direct: String(f.exclude_direct),
          ...renewals(f),
        })
      : queryForFilters(f, opts.region ? undefined : opts.bbox);
    if (opts.region) q.set("region_code", opts.region);
    q.set("sort", opts.sort ?? "contract_date_desc");
    q.set("include_cancelled", String(opts.cancelled ?? false));
    q.set("page", String(opts.page ?? 1));
    q.set("page_size", String(opts.pageSize ?? 20));
    return this.client.get<Transaction[]>(
      `${opts.complexId ? `/complexes/${encodeURIComponent(opts.complexId)}/transactions` : "/transactions"}?${q}`,
      signal,
    );
  }
  // 해제된 거래·갱신 계약도 조회된다
  transaction(id: string, signal?: AbortSignal) {
    if (this.mode === "sample") {
      const tx = TRANSACTIONS.find((t) => t.id === id);
      return tx
        ? Promise.resolve<Envelope<Transaction>>({
            data: tx,
            meta: SAMPLE_META,
          })
        : Promise.reject(
            new ApiError("거래를 찾을 수 없어요", "RESOURCE_NOT_FOUND"),
          );
    }
    return this.client.get<Transaction>(
      `/transactions/${encodeURIComponent(id)}`,
      signal,
    );
  }
  // 단지·동네·주소 검색에 학교 이름 검색을 붙인다. 학교를 못 찾아도 나머지 결과는 그대로 준다
  // 학교 목록이 느려도 검색이 멈추지 않게, 통합 검색이 끝난 뒤 잠깐만 더 기다린다
  async search(q: string, signal?: AbortSignal) {
    const request =
      this.mode === "sample"
        ? Promise.resolve({ data: sampleSearch(q) })
        : this.client.get<SearchResult[]>(
            `/search?q=${encodeURIComponent(q)}&limit=30`,
            signal,
          );
    const schools = this.searchSchools(q).catch(() => [] as SearchResult[]);
    const base = await request;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    // 시간이 지나거나 검색이 취소되면 학교 없이 끝낸다
    const late = new Promise<SearchResult[]>((resolve) => {
      timer = setTimeout(() => resolve([]), SCHOOL_SEARCH_WAIT_MS);
      onAbort = () => resolve([]);
      signal?.addEventListener("abort", onAbort);
    });
    try {
      const found = await Promise.race([schools, late]);
      // 새 백엔드는 학교도 통합 검색에 담아 준다. 같은 학교는 한 번만 둔다
      const seen = new Set(base.data.flatMap((x) => (x.school ? [x.school.id] : [])));
      const extra = found.filter((x) => {
        const id = x.school?.id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      return { ...base, data: [...base.data, ...extra] };
    } finally {
      clearTimeout(timer);
      if (onAbort) signal?.removeEventListener("abort", onAbort);
    }
  }
  // 검색창을 열 때 학교 목록을 미리 받아 둔다. 실패해도 검색 때 다시 받는다
  prefetchSchools() {
    void this.searchSchools("").catch(() => {});
  }
  // 학교 이름 검색. 서버에 학교 검색이 없어 부산 학교 목록을 한 번 받아 두고 이름으로 거른다.
  // /schools는 한 번에 500곳까지라 초등학교와 나머지를 나눠 받는다.
  // 목록은 다음 검색에도 쓰니 검색 하나가 취소돼도 받기를 멈추지 않는다
  private schoolDirectory?: Promise<School[]>;
  private async searchSchools(q: string): Promise<SearchResult[]> {
    if (!this.schoolDirectory) {
      const p = (level: string) =>
        new URLSearchParams({ bbox: BUSAN_BBOX.join(","), level });
      this.schoolDirectory =
        this.mode === "sample"
          ? Promise.resolve(SCHOOLS)
          : Promise.all(
              ["elementary", "middle,high,special,other"].map((level) =>
                this.client.get<School[]>(`/schools?${p(level)}`),
              ),
            ).then((r) => r.flatMap((x) => x.data));
      // 실패하면 다음 검색에서 다시 받는다
      this.schoolDirectory.catch(() => (this.schoolDirectory = undefined));
    }
    const key = q.replace(/\s+/g, "");
    return (await this.schoolDirectory)
      .filter(
        (x) => x.lat != null && x.lng != null && x.name.replace(/\s+/g, "").includes(key),
      )
      .slice(0, SCHOOL_SEARCH_LIMIT)
      .map((x) => ({
        type: "school" as const,
        name: x.name,
        address: x.address,
        lat: x.lat!,
        lng: x.lng!,
        school: x,
      }));
  }
  glossary(signal?: AbortSignal) {
    return this.mode === "sample"
      ? Promise.resolve({ data: TERMS })
      : this.client.get<Term[]>("/glossary", signal);
  }
  term(id: string, signal?: AbortSignal) {
    if (this.mode === "sample") {
      const term = TERMS.find((t) => t.id === id);
      return term
        ? Promise.resolve<Envelope<Term>>({ data: term })
        : Promise.reject(
            new ApiError("용어를 찾을 수 없어요", "RESOURCE_NOT_FOUND"),
          );
    }
    return this.client.get<Term>(`/glossary/${encodeURIComponent(id)}`, signal);
  }
  stats(
    f: Filters,
    id: string,
    kind: "complex" | "region",
    signal?: AbortSignal,
  ) {
    const q = new URLSearchParams({
      property_type: f.property_type,
      deal_type: f.deal_type,
      period_months:
        kind === "complex" ? String(TREND_MONTHS) : String(f.period_months),
      exclude_direct: String(f.exclude_direct),
      ...renewals(f),
    });
    return this.mode === "sample"
      ? Promise.resolve({ data: SAMPLE_STATS, meta: SAMPLE_META })
      : this.client.get<Stats>(
          `${kind === "complex" ? `/complexes/${encodeURIComponent(id)}/stats` : `/stats/regions/${encodeURIComponent(id)}`}?${q}`,
          signal,
        );
  }
  analysis(
    id: string,
    signal?: AbortSignal,
    filters?: Filters,
  ): Promise<Envelope<Analysis>> {
    if (this.mode === "sample")
      return Promise.resolve({
        data: {
          zonings: null,
          comparison: null,
          disclaimer: "샘플 통계 · 실제 거래 정보가 아닙니다",
        },
        meta: SAMPLE_META,
      });
    const q = new URLSearchParams({
      deal_type: filters?.deal_type ?? "sale",
      period_months: String(TREND_MONTHS),
      exclude_direct: String(filters?.exclude_direct ?? false),
      ...(filters ? renewals(filters) : {}),
    });
    return this.client.get<Analysis>(
      `/analysis/complexes/${encodeURIComponent(id)}?${q}`,
      signal,
    );
  }
  // 토지 정보(VWorld 미사용으로 공급처 없음)는 지금 항상 data: null + unavailable_reason으로 온다
  parcelLookup(lat: number, lng: number, signal?: AbortSignal) {
    return this.mode === "sample"
      ? Promise.resolve<Envelope<Parcel | null>>({
          data: null,
          meta: { unavailable_reason: "source_unavailable" },
        })
      : this.client.get<Parcel | null>(
          `/parcels/lookup?lat=${lat}&lng=${lng}`,
          signal,
        );
  }
  // 경매·공매 목록. 샘플 모드는 서버 대역이라 여기서 거른다
  auctions(
    q: AuctionQuery,
    signal?: AbortSignal,
  ): Promise<Envelope<Auction[]>> {
    if (this.mode === "sample") {
      const [w, s, e, n] = q.bbox ?? [-180, -90, 180, 90];
      const data = AUCTIONS.filter(
        (a) =>
          (!q.bbox ||
            (a.lng != null &&
              a.lat != null &&
              a.lng >= w &&
              a.lng <= e &&
              a.lat >= s &&
              a.lat <= n)) &&
          (!q.complexId || a.complex_id === q.complexId) &&
          (!q.source || a.source === q.source) &&
          (!q.groups?.length || q.groups.includes(a.property_group)) &&
          (!q.excludeShare || !a.is_share) &&
          (q.includeClosed || !a.is_closed),
      );
      return Promise.resolve({
        data,
        meta: {
          ...AUCTION_META,
          page: 1,
          page_size: q.pageSize ?? 100,
          total: data.length,
          total_pages: 1,
        },
      });
    }
    const p = new URLSearchParams();
    if (q.bbox) p.set("bbox", q.bbox.join(","));
    if (q.complexId) p.set("complex_id", q.complexId);
    if (q.source) p.set("source", q.source);
    if (q.groups?.length) p.set("property_group", q.groups.join(","));
    if (q.includeClosed != null)
      p.set("include_closed", String(q.includeClosed));
    if (q.page != null) p.set("page", String(q.page));
    if (q.pageSize != null) p.set("page_size", String(q.pageSize));
    if (q.sort) p.set("sort", q.sort);
    if (q.excludeShare != null) p.set("exclude_share", String(q.excludeShare));
    return this.client.get<Auction[]>(`/auctions?${p}`, signal);
  }
  auction(id: string, signal?: AbortSignal): Promise<Envelope<AuctionDetail>> {
    if (this.mode === "sample") {
      const found = AUCTIONS.find((a) => a.id === id);
      return found
        ? Promise.resolve({ data: found, meta: AUCTION_META })
        : Promise.reject(
            new ApiError("경매 물건을 찾을 수 없어요", "RESOURCE_NOT_FOUND"),
          );
    }
    return this.client.get<AuctionDetail>(
      `/auctions/${encodeURIComponent(id)}`,
      signal,
    );
  }
  // 화면 영역 안의 학교. 샘플 모드는 서버 대역이라 여기서 거른다
  schools(bbox: BBox, signal?: AbortSignal): Promise<Envelope<School[]>> {
    if (this.mode === "sample") {
      const [w, s, e, n] = bbox;
      const data = SCHOOLS.filter(
        (x) =>
          x.lng != null &&
          x.lat != null &&
          x.lng >= w &&
          x.lng <= e &&
          x.lat >= s &&
          x.lat <= n,
      );
      return Promise.resolve({ data, meta: SCHOOL_META });
    }
    const p = new URLSearchParams({ bbox: bbox.join(",") });
    return this.client.get<School[]>(`/schools?${p}`, signal);
  }
  // 화면 영역 안의 병원. 지도에는 종합병원·병원·의원만 올린다
  hospitals(bbox: BBox, signal?: AbortSignal): Promise<Envelope<Hospital[]>> {
    if (this.mode === "sample") {
      const [w, s, e, n] = bbox;
      const data = HOSPITALS.filter(
        (x) =>
          (HOSPITAL_TIERS as readonly string[]).includes(x.tier) &&
          x.lng != null &&
          x.lat != null &&
          x.lng >= w &&
          x.lng <= e &&
          x.lat >= s &&
          x.lat <= n,
      );
      return Promise.resolve({ data, meta: HOSPITAL_META });
    }
    const p = new URLSearchParams({
      bbox: bbox.join(","),
      tier: HOSPITAL_TIERS.join(","),
    });
    return this.client.get<Hospital[]>(`/hospitals?${p}`, signal);
  }
  // 초등학교 통학구역 경계. 통학구역이 없는 학교는 404(RESOURCE_NOT_FOUND)다
  schoolZone(
    schoolId: string,
    signal?: AbortSignal,
  ): Promise<Envelope<SchoolZone>> {
    if (this.mode === "sample") {
      const zone = SCHOOL_ZONES.find((z) => z.school_id === schoolId);
      return zone
        ? Promise.resolve({ data: zone, meta: SCHOOL_ZONE_META })
        : Promise.reject(new ApiError("통학구역 없음", "RESOURCE_NOT_FOUND"));
    }
    // 서버에 구역이 없으면(학구도 API 미배포 포함) 앱에 넣어 둔 참고용 경계를 쓴다
    return this.client
      .get<SchoolZone>(`/schools/${encodeURIComponent(schoolId)}/zone`, signal)
      .catch((e) => {
        const local = LOCAL_SCHOOL_ZONES.find((z) => z.school_id === schoolId);
        if (e?.code === "RESOURCE_NOT_FOUND" && local)
          return { data: local, meta: LOCAL_ZONE_META };
        throw e;
      });
  }
  // 화면 영역 안의 정비사업 구역. 좌표가 있는 구역 중 고른 단계만 받는다
  redevelopments(
    bbox: BBox,
    stages: readonly RedevelopmentStage[],
    signal?: AbortSignal,
  ): Promise<Envelope<Redevelopment[]>> {
    if (this.mode === "sample") {
      const [w, s, e, n] = bbox;
      const data = REDEVELOPMENTS.filter(
        (x) =>
          stages.includes(x.stage) &&
          !x.is_closed &&
          x.lng != null &&
          x.lat != null &&
          x.lng >= w &&
          x.lng <= e &&
          x.lat >= s &&
          x.lat <= n,
      );
      return Promise.resolve({ data, meta: REDEVELOPMENT_META });
    }
    const p = new URLSearchParams({
      bbox: bbox.join(","),
      stage: stages.join(","),
      page_size: String(REDEVELOPMENT_LIMIT),
    });
    return this.client
      .get<Redevelopment[]>(`/redevelopments?${p}`, signal)
      .then((r) => ({ ...r, data: r.data.map(cleanRedevelopment) }));
  }
  // 구역 1건. 경계와 이어졌지만 지도 목록에 없는 구역(대표점이 화면 밖·준공 등)을 열 때 쓴다
  redevelopment(
    id: string,
    signal?: AbortSignal,
  ): Promise<Envelope<Redevelopment>> {
    if (this.mode === "sample") {
      const found = REDEVELOPMENTS.find((x) => x.id === id);
      return found
        ? Promise.resolve({ data: found, meta: REDEVELOPMENT_META })
        : Promise.reject(
            new ApiError("구역을 찾을 수 없어요", "RESOURCE_NOT_FOUND"),
          );
    }
    return this.client
      .get<Redevelopment>(`/redevelopments/${encodeURIComponent(id)}`, signal)
      .then((r) => ({ ...r, data: cleanRedevelopment(r.data) }));
  }
  // 화면 영역 안의 정비구역 경계. zoom을 주면 서버가 화면 1px보다 작은 굴곡을 줄여 보낸다
  redevelopmentZones(
    bbox: BBox,
    zoom: number,
    signal?: AbortSignal,
  ): Promise<Envelope<RedevelopmentZone[]>> {
    if (this.mode === "sample") {
      const [w, s, e, n] = bbox;
      const data = REDEVELOPMENT_ZONES.filter((z) =>
        z.geometry.coordinates
          .flat(2)
          .some(([lng, lat]) => lng >= w && lng <= e && lat >= s && lat <= n),
      );
      return Promise.resolve({ data, meta: REDEVELOPMENT_ZONE_META });
    }
    const p = new URLSearchParams({
      bbox: bbox.join(","),
      zoom: String(Math.round(zoom)),
    });
    return this.client.get<RedevelopmentZone[]>(
      `/redevelopment-zones?${p}`,
      signal,
    );
  }
  // 단지 주변 학교. 샘플 모드는 서버처럼 직선거리 3km 안에서 학교급별 가까운 3곳을 고른다
  nearby(complexId: string, signal?: AbortSignal): Promise<Envelope<Nearby>> {
    if (this.mode === "sample") {
      const c = COMPLEXES.find((x) => x.id === complexId);
      const radius = 3000;
      const pick = (level: School["level"]) =>
        c
          ? SCHOOLS.filter(
              (x) => x.level === level && x.lat != null && x.lng != null,
            )
              .map((x) => ({
                ...x,
                distance_m: Math.round(distanceM(c.lat, c.lng, x.lat!, x.lng!)),
              }))
              .filter((x) => x.distance_m <= radius)
              .sort((a, b) => a.distance_m - b.distance_m)
              .slice(0, 3)
          : [];
      const elementary = pick("elementary");
      return Promise.resolve({
        data: {
          schools: {
            radius_m: radius,
            // 샘플에는 학구도가 없어 가장 가까운 초등학교를 배정 학교로 둔다
            assigned_elementary: elementary[0] ?? null,
            elementary,
            middle: pick("middle"),
            high: pick("high"),
          },
        },
        meta: SCHOOL_META,
      });
    }
    return this.client.get<Nearby>(
      `/complexes/${encodeURIComponent(complexId)}/nearby`,
      signal,
    );
  }
  // 내 관심 id 전체. 별을 켜고 끌 때 쓴다
  interestIds(signal?: AbortSignal): Promise<Envelope<InterestIds>> {
    if (this.interestMode === "sample")
      return Promise.resolve({
        data: {
          complexes: newestFirst(sampleInterests.complex).map(([id]) => id),
          auctions: newestFirst(sampleInterests.auction).map(([id]) => id),
        },
      });
    return this.client.get<InterestIds>("/interests", signal, AUTH);
  }
  // 관심 등록·해제. 같은 요청을 여러 번 보내도 결과가 같다
  async setInterest(kind: InterestKind, id: string, on: boolean) {
    if (this.interestMode === "sample") {
      const store = sampleInterests[kind];
      // 실제 데이터면 샘플에 없는 id도 받는다
      const known =
        this.mode !== "sample" ||
        (kind === "complex"
          ? COMPLEXES.some((c) => c.id === id)
          : AUCTIONS.some((a) => a.id === id));
      if (!on) {
        store.delete(id);
        return;
      }
      if (!known)
        throw new ApiError(
          kind === "complex" ? "단지를 찾을 수 없어요" : "경매 물건을 찾을 수 없어요",
          "RESOURCE_NOT_FOUND",
        );
      if (!store.has(id) && store.size >= INTEREST_LIMIT)
        throw new ApiError(
          `관심 ${kind === "complex" ? "단지" : "경매"}는 ${INTEREST_LIMIT}개까지 담을 수 있어요`,
          "CONFLICT",
        );
      if (!store.has(id)) store.set(id, new Date().toISOString());
      return;
    }
    const path = `/interests/${kind === "complex" ? "complexes" : "auctions"}/${encodeURIComponent(id)}`;
    await this.client.send(on ? "PUT" : "DELETE", path);
  }
  // 관심 단지 목록 화면. complex는 단지 상세와 같은 모양이다
  complexInterests(
    signal?: AbortSignal,
  ): Promise<Envelope<ComplexInterest[]>> {
    // 미리보기: 담은 id를 공개 단지 API로 채운다. 최근 매매는 비워 둔다
    if (this.interestMode === "sample" && this.mode !== "sample")
      return this.localInterests(sampleInterests.complex, (id, added_at) =>
        this.complex(id, signal).then(({ data, meta }) => ({
          item: { complex: data, latest_sale: null, added_at },
          meta,
        })),
      );
    if (this.interestMode === "sample")
      return Promise.resolve({
        data: newestFirst(sampleInterests.complex).flatMap(([id, added_at]) => {
          const complex = COMPLEXES.find((c) => c.id === id);
          if (!complex) return [];
          const latest_sale =
            TRANSACTIONS.filter(
              (t) =>
                t.complex_id === id && t.deal_type === "sale" && !t.is_cancelled,
            ).sort((a, b) =>
              b.contract_date.localeCompare(a.contract_date),
            )[0] ?? null;
          return [{ complex, latest_sale, added_at }];
        }),
        meta: SAMPLE_META,
      });
    return this.client.get<ComplexInterest[]>(
      "/interests/complexes",
      signal,
      AUTH,
    );
  }
  // 관심 경매 목록 화면. auction은 /auctions 목록 항목과 같은 모양이고 끝난 물건도 남는다
  auctionInterests(
    signal?: AbortSignal,
  ): Promise<Envelope<AuctionInterest[]>> {
    if (this.interestMode === "sample" && this.mode !== "sample")
      return this.localInterests(sampleInterests.auction, (id, added_at) =>
        this.auction(id, signal).then(({ data, meta }) => ({
          item: { auction: data, added_at },
          meta,
        })),
      );
    if (this.interestMode === "sample")
      return Promise.resolve({
        data: newestFirst(sampleInterests.auction).flatMap(([id, added_at]) => {
          const auction = AUCTIONS.find((a) => a.id === id);
          return auction ? [{ auction, added_at }] : [];
        }),
        meta: AUCTION_META,
      });
    return this.client.get<AuctionInterest[]>(
      "/interests/auctions",
      signal,
      AUTH,
    );
  }
  // 앱 안에 담은 관심 id를 최근 순으로 하나씩 받아 목록을 만든다. 못 받은 것은 뺀다
  private async localInterests<T>(
    store: Map<string, string>,
    fetchOne: (
      id: string,
      added_at: string,
    ) => Promise<{ item: T; meta?: Envelope<T>["meta"] }>,
  ): Promise<Envelope<T[]>> {
    const got = await Promise.all(
      newestFirst(store).map(([id, added_at]) =>
        fetchOne(id, added_at).catch(() => null),
      ),
    );
    const found = got.filter((g) => g !== null);
    return { data: found.map((g) => g.item), meta: found[0]?.meta };
  }
  // 집 → 직장 대중교통 경로. 백엔드가 ODsay를 대신 호출한다(키는 서버에만 둔다)
  transitRoute(
    from: LatLng,
    to: LatLng,
    signal?: AbortSignal,
  ): Promise<Envelope<TransitResult>> {
    if (this.mode === "sample") return Promise.resolve(sampleTransit(from, to));
    return this.client
      .get<TransitResult>(`/transit/routes?${transitQuery(from, to)}`, signal)
      .catch((e) => {
        // 백엔드에 아직 길찾기가 없으면(404) "준비 중", 공급처 장애(503)는 다시 시도할 수 있게 알린다
        const reason =
          e instanceof ApiError && e.code === "RESOURCE_NOT_FOUND"
            ? "not_ready"
            : e instanceof ApiError && e.code === "SOURCE_UNAVAILABLE"
              ? "source_unavailable"
              : null;
        if (!reason) throw e;
        return { data: { routes: [], unavailable_reason: reason } };
      });
  }
  // 알림 목록(최근 것부터). meta.unread_count가 안 읽은 알림 수다.
  // 배지처럼 개수만 필요하면 pageSize를 1로 준다
  notifications(
    page: number,
    signal?: AbortSignal,
    pageSize = NOTIFICATION_PAGE_SIZE,
  ): Promise<Envelope<AppNotification[]>> {
    // 알림은 계정에 묶여 있어 관심 목록과 같이 interestMode를 따른다.
    // 샘플 로그인(미리보기)의 가짜 토큰은 서버에서 401만 나기 때문이다
    if (this.interestMode === "sample") {
      const all = SAMPLE_REPORTS.map(sampleNotification);
      const start = (page - 1) * pageSize;
      const meta: NotificationMeta = {
        ...SAMPLE_META,
        page,
        page_size: pageSize,
        total: all.length,
        total_pages: Math.max(1, Math.ceil(all.length / pageSize)),
        unread_count: all.filter((n) => !n.read_at).length,
      };
      return Promise.resolve({
        // 목록에는 payload를 싣지 않는다
        data: all
          .slice(start, start + pageSize)
          .map(({ payload: _payload, ...n }) => n),
        meta,
      });
    }
    const q = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    return this.client.get<AppNotification[]>(
      `/notifications?${q}`,
      signal,
      AUTH,
    );
  }
  // 알림 한 건(리포트 payload 포함)
  notification(
    id: string,
    signal?: AbortSignal,
  ): Promise<Envelope<InterestReport>> {
    if (this.interestMode === "sample") {
      const found = SAMPLE_REPORTS.find((n) => n.id === id);
      return found
        ? Promise.resolve({
            data: sampleNotification(found),
            meta: SAMPLE_META,
          })
        : Promise.reject(
            new ApiError("알림을 찾을 수 없어요", "RESOURCE_NOT_FOUND"),
          );
    }
    return this.client.get<InterestReport>(
      `/notifications/${encodeURIComponent(id)}`,
      signal,
      AUTH,
    );
  }
  // 알림 읽음 처리. ids로 고른 것만, "all"이면 전부
  async markNotificationsRead(target: string[] | "all") {
    if (this.interestMode === "sample") {
      const now = new Date().toISOString();
      const ids = target === "all" ? SAMPLE_REPORTS.map((n) => n.id) : target;
      for (const id of ids) if (!sampleRead.has(id)) sampleRead.set(id, now);
      return;
    }
    await this.client.send(
      "POST",
      "/notifications/read",
      target === "all" ? { all: true } : { ids: target },
    );
  }
  // 주간 리포트 받기 설정. 샘플(미리보기 포함)은 앱 안에만 둔다
  async reportSetting(signal?: AbortSignal): Promise<ReportSetting> {
    if (this.interestMode === "sample") return { ...sampleReportSetting };
    const r = await this.client.get<ReportSetting>(
      "/notifications/settings",
      signal,
      AUTH,
    );
    return r.data;
  }
  // 주간 리포트 받기를 켜고 끈다. 서버가 저장한 값을 돌려준다
  async setReportSetting(on: boolean): Promise<ReportSetting> {
    if (this.interestMode === "sample") {
      sampleReportSetting.weekly_report = on;
      return { ...sampleReportSetting };
    }
    const r = await this.client.send<ReportSetting>(
      "PUT",
      "/notifications/settings",
      { weekly_report: on },
    );
    // 204로 답하면 보낸 값이 저장된 것으로 본다
    return r?.data ?? { weekly_report: on };
  }
  // 검색 결과·필지 마커처럼 PNU를 이미 알 때. 응답 형태는 parcelLookup과 같다
  parcel(pnu: string, signal?: AbortSignal) {
    return this.mode === "sample"
      ? Promise.resolve<Envelope<Parcel | null>>({
          data: null,
          meta: { unavailable_reason: "source_unavailable" },
        })
      : this.client.get<Parcel | null>(
          `/parcels/${encodeURIComponent(pnu)}`,
          signal,
        );
  }
}
// 갱신 계약 포함은 전세·월세에서 켰을 때만 보낸다 (서버 기본 false)
const renewals = (f: Filters): Record<string, string> =>
  f.deal_type !== "sale" && f.include_renewals
    ? { include_renewals: "true" }
    : {};
// 두 좌표 사이 직선거리(m). 샘플 모드에서 서버의 거리 계산을 흉내 낸다
function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) *
      Math.cos(lat2 * r) *
      Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}
