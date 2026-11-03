import { ApiClient, ApiError } from "./client";
import type {
  Analysis,
  Auction,
  AuctionDetail,
  AuctionQuery,
  BBox,
  Complex,
  Envelope,
  Filters,
  MarkerData,
  Nearby,
  Parcel,
  School,
  SearchResult,
  Sort,
  Stats,
  Term,
  Transaction,
} from "./types";
import {
  AUCTIONS,
  AUCTION_META,
  COMPLEXES,
  SAMPLE_META,
  SCHOOLS,
  SCHOOL_META,
  SAMPLE_STATS,
  TERMS,
  TRANSACTIONS,
  sampleMarkers,
  sampleSearch,
  sampleTransactions,
} from "./fixtures";
import { queryForFilters, TREND_MONTHS } from "../state/market";
export type Mode = "api" | "sample";
export class Repository {
  constructor(
    public mode: Mode,
    private client: ApiClient,
  ) {}
  markers(f: Filters, b: BBox, z: number, signal?: AbortSignal) {
    return this.mode === "sample"
      ? Promise.resolve(sampleMarkers(f, b, z))
      : this.client.get<MarkerData>(
          `/map/markers?${queryForFilters(f, b, z)}`,
          signal,
        );
  }
  complex(id: string, signal?: AbortSignal) {
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
    q.set("page_size", "20");
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
  search(q: string, signal?: AbortSignal) {
    return this.mode === "sample"
      ? Promise.resolve({ data: sampleSearch(q) })
      : this.client.get<SearchResult[]>(
          `/search?q=${encodeURIComponent(q)}&limit=30`,
          signal,
        );
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
