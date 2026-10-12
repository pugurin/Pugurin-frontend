import { ApiClient, ApiError } from "./client";
import type {
  Analysis,
  BBox,
  Complex,
  Envelope,
  Filters,
  MarkerData,
  Parcel,
  SearchResult,
  Sort,
  Stats,
  Term,
  Transaction,
} from "./types";
import {
  COMPLEXES,
  SAMPLE_META,
  SAMPLE_STATS,
  TERMS,
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
}
