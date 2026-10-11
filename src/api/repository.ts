import { ApiClient, ApiError } from "./client";
import type {
  Analysis,
  BBox,
  Complex,
  Envelope,
  Filters,
  MarkerData,
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
import { queryForFilters } from "../state/market";
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
    if (!opts.complexId)
      return Promise.reject(
        new ApiError(
          "지역·지도 영역의 거래 목록 API가 준비 중이에요",
          "API_PENDING",
        ),
      );
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
      period_months: kind === "complex" ? "36" : String(f.period_months),
      exclude_direct: String(f.exclude_direct),
    });
    return this.mode === "sample"
      ? Promise.resolve({ data: SAMPLE_STATS, meta: SAMPLE_META })
      : this.client.get<Stats>(
          `${kind === "complex" ? `/complexes/${encodeURIComponent(id)}/stats` : `/stats/regions/${encodeURIComponent(id)}`}?${q}`,
          signal,
        );
  }
  analysis(id: string, signal?: AbortSignal): Promise<Envelope<Analysis>> {
    return this.mode === "sample"
      ? Promise.resolve({
          data: {
            zoning_summary: {
              zone_type: "제3종일반주거지역",
              plain_explanation:
                "중간 높이 이상의 아파트를 지을 수 있는 주거지역이에요.",
              max_building_coverage_ratio: 50,
              max_floor_area_ratio: 300,
              ratio_source: "샘플 · 부산광역시 도시계획 조례",
            },
          },
        })
      : Promise.reject<Envelope<Analysis>>(
          new ApiError("분석 API가 준비 중이에요", "API_PENDING"),
        );
  }
}
