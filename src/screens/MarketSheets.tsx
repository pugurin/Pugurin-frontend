import React, { useEffect, useState } from "react";
import { Pressable, View, Platform, useWindowDimensions } from "react-native";
import type { Repository } from "../api/repository";
import type {
  Analysis,
  Auction,
  Complex,
  Filters,
  Meta,
  RegionMarker,
  Sort,
  Stats,
  Transaction,
} from "../api/types";
import { C } from "../theme/tokens";
import {
  DEAL,
  PROPERTY,
  formatArea,
  formatPrice,
  markerLabel,
  priceLabel,
  TREND_MONTHS,
} from "../state/market";
import {
  Btn,
  Chip,
  Help,
  Icon,
  Notice,
  Section,
  StateCard,
  T,
  UnitToggle,
  s,
} from "../components/ui";
import { auctionSub, dday, ddayKey, formatWon } from "../state/auction";
import { areaOf } from "./AuctionContent";
import { LoadingTip } from "../components/LoadingTip";
import { Chart } from "../components/Chart";
import { TransactionRow } from "../components/TransactionRow";
import type { SheetStage } from "../components/Sheet";
import { HAS_KAKAO } from "../map/kakaoRuntime";
import { RoadviewModal } from "../roadview/RoadviewModal";
import { NearbySchoolsSection } from "./NearbySchools";
import { StarButton } from "../components/StarButton";
import { isDong } from "../state/interests";

// 단지 상세에서 거래 이력을 처음 펼쳐 두는 건수. 나머지는 더보기로 연다
export const TX_PREVIEW = 4;
export function RegionContent({
  marker,
  filters,
  repo,
  onList,
  onComplex,
  onHelp,
  date,
  unit,
  onUnit,
}: {
  marker: RegionMarker;
  filters: Filters;
  repo: Repository;
  onList: () => void;
  onComplex: (id: string) => void;
  onHelp: (name: string) => void;
  date?: string;
  unit: "평" | "㎡";
  onUnit?: (u: "평" | "㎡") => void;
}) {
  const { width } = useWindowDimensions();
  const twoColumns = Platform.OS === "web" && width >= 768 && width < 1024;
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsMessage, setStatsMessage] = useState<string | null>(null);
  const [items, setItems] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const a = new AbortController();
    setLoading(true);
    setStats(null);
    setItems([]);
    setError(null);
    setStatsMessage(null);
    Promise.allSettled([
      repo.stats(filters, marker.region_code, "region", a.signal),
      repo.transactions(filters, { region: marker.region_code }, a.signal),
    ]).then(([st, tx]) => {
      if (a.signal.aborted) return;
      if (st.status === "fulfilled") setStats(st.value.data);
      if (tx.status === "fulfilled") setItems(tx.value.data.slice(0, 4));
      if (st.status === "rejected") setStatsMessage(st.reason.message);
      if (tx.status === "rejected") setError(tx.reason.message);
      setLoading(false);
    });
    return () => a.abort();
  }, [repo, filters, marker.region_code, retry]);
  return (
    <>
      <View style={s.between}>
        <T size={22} bold style={{ flex: 1 }}>
          {marker.name}
        </T>
        {onUnit && <UnitToggle unit={unit} onUnit={onUnit} />}
        {/* 관심 지역은 법정동 단위라 시·군·구 시트에는 없다 */}
        {isDong(marker.region_code) && (
          <StarButton
            kind="region"
            item={{
              region_code: marker.region_code,
              name: marker.name,
              lat: marker.lat,
              lng: marker.lng,
            }}
          />
        )}
      </View>
      <T size={14} color={C.muted}>
        {PROPERTY[filters.property_type]} · {DEAL[filters.deal_type]} · 최근{" "}
        {filters.period_months}개월
      </T>
      <View style={[s.row, { marginTop: 16 }]}>
        <View style={[s.card, { flex: 1, gap: 6 }]}>
          <View style={s.row}>
            <T size={14} color={C.muted}>
              {filters.deal_type === "monthly"
                ? "보증금 · 월세"
                : "평당가 중위값"}
            </T>
            <Help onPress={() => onHelp("중위값")} />
          </View>
          <T bold size={21}>
            {markerLabel(
              stats ? { ...marker, summary: stats } : marker,
            ).replace("평당 ", "")}
          </T>
          <T size={12} color={C.light}>
            {filters.property_type === "land"
              ? "토지면적 기준"
              : "전용면적 기준"}
          </T>
        </View>
        <View style={[s.card, { flex: 0.7, gap: 6 }]}>
          <T size={14} color={C.muted}>
            거래 건수
          </T>
          <T size={24} bold>
            {(
              stats?.transaction_count ?? marker.transaction_count
            ).toLocaleString()}
            건
          </T>
        </View>
      </View>
      <View
        style={{
          flexDirection: twoColumns ? "row" : "column",
          gap: twoColumns ? 20 : 0,
        }}
      >
        <View style={{ flex: twoColumns ? 1 : undefined, minWidth: 0 }}>
          <Section
            title={
              filters.deal_type === "monthly"
                ? "월별 월세 (중위값)"
                : "월별 평당가 (중위값)"
            }
          >
            {stats ? (
              <Chart
                trend={stats.trend}
                bar
                metric={
                  filters.deal_type === "sale"
                    ? "median_price_per_pyeong"
                    : filters.deal_type === "jeonse"
                      ? "median_deposit_per_pyeong"
                      : "median_monthly_rent"
                }
              />
            ) : loading ? (
              <StateCard loading />
            ) : (
              <T size={14} color={C.light}>
                {statsMessage ?? "표시할 지역 통계가 없어요"}
              </T>
            )}
          </Section>
        </View>
        <View style={{ flex: twoColumns ? 1 : undefined, minWidth: 0 }}>
          <Section title="최근 거래">
            {items.map((tx) => (
              <TransactionRow
                tx={tx}
                key={tx.id}
                unit={unit}
                name={tx.complex_name ?? tx.address}
                onPress={
                  tx.complex_id ? () => onComplex(tx.complex_id!) : undefined
                }
              />
            ))}
            {error && (
              <StateCard error={error} onRetry={() => setRetry((x) => x + 1)} />
            )}
            <Btn secondary onPress={onList}>
              목록 전체 보기
            </Btn>
          </Section>
        </View>
      </View>
      <View style={[s.card, { borderStyle: "dashed" }]}>
        <T color={C.light} size={14}>
          ⏸ 주변 중개사 연결은 보류 중이에요
        </T>
      </View>
      <Notice date={date} mode={repo.mode} />
    </>
  );
}
// 기일이 가장 가까운 물건. 날짜가 없는 물건은 뒤로 밀고, 같으면 서버 순서를 지킨다
function nearestAuction(list: Auction[]): Auction {
  // 한국 날짜 기준으로 견준다. 같은 날이면 앞선(서버 순서) 물건을 둔다
  const time = (a: Auction) => ddayKey(a) ?? Infinity;
  return list.reduce((best, a) => (time(a) < time(best) ? a : best));
}
// 단지 시트의 경매 카드. 1건이면 그 물건, 여러 건이면 이 단지로 거른 목록으로 보낸다
function ComplexAuctionCard({
  list,
  unit,
  onPress,
}: {
  list: Auction[];
  unit: "평" | "㎡";
  onPress: () => void;
}) {
  const a = nearestAuction(list);
  const today = new Date();
  const d = dday(a, today);
  const price = `최저가 ${a.min_price == null ? "미정" : formatWon(a.min_price)}`;
  // auctionSub가 D-day를 돌려주면 헤더 "입찰 D-N"과 겹치므로 뺀다
  const sub = auctionSub(a, today);
  const detail = [
    sub === d?.label ? null : sub,
    areaOf(a, unit),
    a.fail_count == null ? null : `유찰 ${a.fail_count}회`,
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        marginTop: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: C.brown,
        borderRadius: 12,
        backgroundColor: C.brownWash,
        gap: 2,
      }}
    >
      <View style={s.between}>
        <T size={15} bold color={C.brownInk}>
          ⚖ 이 단지 경매 {list.length}건
        </T>
        {d && (
          <T size={14} bold color={d.soon ? C.brown : C.muted}>
            입찰 {d.label}
          </T>
        )}
      </View>
      <T size={14} color={C.ink2}>
        {[price, ...detail].join(" · ")}
      </T>
    </Pressable>
  );
}
export function ComplexContent({
  id,
  repo,
  filters,
  stage,
  onStage,
  onHelp,
  notify,
  unit,
  onUnit,
  onAuction,
  onAuctionList,
}: {
  id: string;
  repo: Repository;
  filters: Filters;
  stage: SheetStage;
  onStage: (s: SheetStage) => void;
  onHelp: (name: string) => void;
  notify: (s: string) => void;
  unit: "평" | "㎡";
  onUnit?: (u: "평" | "㎡") => void;
  onAuction?: (id: string) => void;
  onAuctionList?: (complexId: string, name: string) => void;
}) {
  const { width } = useWindowDimensions();
  const twoColumns = Platform.OS === "web" && width >= 768 && width < 1024;
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [complex, setComplex] = useState<Complex | null>(null);
  const [items, setItems] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [comparison, setComparison] = useState<Stats | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisRetry, setAnalysisRetry] = useState(0);
  const [meta, setMeta] = useState<Meta>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [sort, setSort] = useState<Sort>("contract_date_desc");
  const [cancelled, setCancelled] = useState(false);
  const [area, setArea] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [roadview, setRoadview] = useState(false);
  const [allTx, setAllTx] = useState(false);
  // 단지·정렬·해제 포함을 바꾸면 다시 4건만 보여준다
  useEffect(() => setAllTx(false), [id, sort, cancelled, filters]);
  useEffect(() => {
    const a = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      repo.complex(id, a.signal),
      repo.transactions(
        filters,
        { complexId: id, sort, cancelled, page },
        a.signal,
      ),
    ])
      .then(([c, t]) => {
        if (a.signal.aborted) return;
        setComplex(c.data);
        setItems((v) => (page === 1 ? t.data : [...v, ...t.data]));
        setMeta(t.meta);
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!a.signal.aborted) setLoading(false);
      });
    return () => a.abort();
  }, [id, repo, filters, sort, cancelled, page, retry]);
  useEffect(() => {
    const a = new AbortController();
    setStats(null);
    setAnalysis(null);
    setAnalysisError(null);
    setStatsError(false);
    if (complex?.id === id)
      repo
        .stats(
          { ...filters, property_type: complex.property_type },
          id,
          "complex",
          a.signal,
        )
        .then((r) => {
          if (!a.signal.aborted) setStats(r.data);
        })
        .catch(() => {
          if (!a.signal.aborted) setStatsError(true);
        });
    repo
      .analysis(id, a.signal, filters)
      .then((r) => {
        if (!a.signal.aborted) setAnalysis(r.data);
      })
      .catch((e) => {
        if (!a.signal.aborted) setAnalysisError(e.message);
      });
    return () => a.abort();
  }, [
    id,
    complex?.id,
    complex?.property_type,
    repo,
    filters,
    retry,
    analysisRetry,
  ]);
  // 이 단지의 진행 중 경매. 오류는 카드만 숨기고 단지 시트는 막지 않는다
  useEffect(() => {
    setAuctions([]);
    const abort = new AbortController();
    repo
      .auctions({ complexId: id }, abort.signal)
      .then((r) => {
        if (!abort.signal.aborted) setAuctions(r.data);
      })
      .catch(() => {});
    return () => abort.abort();
  }, [id, repo]);
  useEffect(() => {
    setComparison(null);
    if (!complex) return;
    const abort = new AbortController();
    repo
      .stats(
        {
          ...filters,
          property_type: complex.property_type,
          period_months: TREND_MONTHS,
        },
        complex.region_code,
        "region",
        abort.signal,
      )
      .then((r) => {
        if (!abort.signal.aborted) setComparison(r.data);
      })
      .catch(() => {});
    return () => abort.abort();
  }, [complex?.region_code, complex?.property_type, repo, filters, retry]);
  if (!complex || error)
    return (
      <>
        <StateCard
          loading={loading}
          error={error}
          onRetry={() => setRetry((x) => x + 1)}
        />
        <LoadingTip loading={loading} error={!!error} context="complex" />
      </>
    );
  const tx = items[0];
  const a =
    complex.area_types.find((a) => a.exclusive_area_m2 === area) ??
    complex.area_types[0];
  const areaStats = stats?.area_types?.find(
    (v) => v.exclusive_area_m2 === a?.exclusive_area_m2,
  );
  const selectedStats = stats?.area_types?.length ? areaStats : stats;
  const metric =
    filters.deal_type === "sale"
      ? "median_price_per_pyeong"
      : filters.deal_type === "jeonse"
        ? "median_deposit_per_pyeong"
        : "median_monthly_rent";
  const auctionCard = auctions.length > 0 && (
    <ComplexAuctionCard
      list={auctions}
      unit={unit}
      onPress={() =>
        auctions.length === 1
          ? onAuction?.(auctions[0].id)
          : onAuctionList?.(complex.id, complex.name)
      }
    />
  );
  return (
    <>
      <View style={s.between}>
        <T size={stage === "full" ? 24 : 21} bold style={{ flex: 1 }}>
          {complex.name}
        </T>
        {onUnit && <UnitToggle unit={unit} onUnit={onUnit} />}
        <StarButton
          kind="complex"
          item={{
            complex_id: complex.id,
            name: complex.name,
            property_type: complex.property_type,
            address: complex.address,
            lat: complex.lat,
            lng: complex.lng,
          }}
        />
      </View>
      <View style={[s.row, { gap: 8 }]}>
        <T size={14} color={C.muted} style={{ flex: 1 }}>
          {PROPERTY[complex.property_type]} ·{" "}
          {complex.address.replace("부산광역시 ", "")}
        </T>
        {HAS_KAKAO && (
          <Btn small secondary icon="pin" onPress={() => setRoadview(true)}>
            로드뷰
          </Btn>
        )}
      </View>
      <RoadviewModal
        visible={roadview}
        title={complex.name}
        lat={complex.lat}
        lng={complex.lng}
        onClose={() => setRoadview(false)}
      />
      {stage === "peek" ? (
        <>
          <T size={28} bold style={{ marginTop: 12 }}>
            {tx ? priceLabel(tx) : "최근 거래 정보 없음"}
          </T>
          {tx && (
            <T>
              {formatArea(
                {
                  ...tx,
                  supply_area_pyeong: complex.area_types.find(
                    (a) => a.exclusive_area_m2 === tx.exclusive_area_m2,
                  )?.supply_area_pyeong,
                },
                unit,
              )}{" "}
              · {tx.floor ?? "—"}층 · {tx.contract_date.replaceAll("-", ".")}{" "}
              계약
            </T>
          )}
          {auctionCard}
          <Pressable
            accessibilityRole="button"
            onPress={() => onStage("half")}
            style={{ paddingVertical: 12 }}
          >
            <T size={14} color={C.light}>
              위로 올리면 단지 정보를 더 볼 수 있어요 ⌃
            </T>
          </Pressable>
        </>
      ) : (
        <>
          {auctionCard}
          {/* 세대수는 공공데이터에 없어 실데이터에서 항상 null, 준공연도도 비어 올 수 있다 → 있는 것만 */}
          {(complex.build_year || complex.household_count) && (
            <T size={14} color={C.muted} style={{ marginVertical: 8 }}>
              {[
                complex.build_year && `${complex.build_year}년 준공`,
                complex.household_count &&
                  `${complex.household_count.toLocaleString()}세대`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </T>
          )}
          <View style={[s.row, { marginVertical: 10, flexWrap: "wrap" }]}>
            {complex.area_types.map((ar) => (
              <Chip
                key={ar.exclusive_area_m2}
                selected={a?.exclusive_area_m2 === ar.exclusive_area_m2}
                onPress={() => {
                  setArea(ar.exclusive_area_m2);
                  setPage(1);
                }}
              >
                {ar.supply_area_pyeong
                  ? `${ar.supply_area_pyeong}평`
                  : `전용 ${ar.exclusive_area_pyeong}평`}
              </Chip>
            ))}
          </View>
          <T size={13} color={C.light}>
            {a?.supply_area_pyeong ? "공급면적 기준" : "전용면적 기준"} · 전용{" "}
            {a?.exclusive_area_pyeong ?? "—"}평
          </T>
          <T size={13} color={C.light}>
            거래 이력은 모든 면적을 표시해요
          </T>
          <Section
            title={
              filters.deal_type === "monthly"
                ? `월세 추이 · 최근 ${TREND_MONTHS / 12}년`
                : `평당가 추이 · 최근 ${TREND_MONTHS / 12}년`
            }
            right={<Help onPress={() => onHelp("평당가")} />}
          >
            {stats ? (
              <Chart
                trend={selectedStats?.trend ?? []}
                comparison={comparison?.trend}
                metric={metric}
              />
            ) : (
              <T size={14} color={C.light}>
                {statsError
                  ? "시세 통계를 불러오지 못했어요"
                  : "시세 추이를 불러오는 중…"}
              </T>
            )}
          </Section>
          {analysis?.comparison?.summary && (
            <T size={14} color={C.muted}>
              전체 평형 기준 · {analysis.comparison.summary}
            </T>
          )}
          {stage === "half" ? (
            <Btn onPress={() => onStage("full")}>자세히 보기</Btn>
          ) : (
            <View
              style={{
                flexDirection: twoColumns ? "row" : "column",
                gap: twoColumns ? 20 : 0,
              }}
            >
              <View style={{ flex: twoColumns ? 1 : undefined, minWidth: 0 }}>
                <Section title="거래 이력">
                  <View style={[s.row, { flexWrap: "wrap" }]}>
                    {(
                      [
                        ["contract_date_desc", "최신순"],
                        ["price_asc", "가격 낮은순"],
                        ["price_desc", "가격 높은순"],
                      ] as const
                    ).map(([k, n]) => (
                      <Chip
                        key={k}
                        selected={sort === k}
                        onPress={() => {
                          setSort(k);
                          setPage(1);
                        }}
                      >
                        {n}
                      </Chip>
                    ))}
                  </View>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: cancelled }}
                    onPress={() => {
                      setCancelled((v) => !v);
                      setPage(1);
                    }}
                    style={[s.row, { paddingVertical: 6 }]}
                  >
                    <Icon name={cancelled ? "check" : "plus"} size={18} />
                    <T size={14}>해제 거래 포함</T>
                  </Pressable>
                  {(allTx ? items : items.slice(0, TX_PREVIEW)).map((t) => (
                    <TransactionRow
                      key={t.id}
                      tx={{
                        ...t,
                        supply_area_pyeong: complex.area_types.find(
                          (a) => a.exclusive_area_m2 === t.exclusive_area_m2,
                        )?.supply_area_pyeong,
                      }}
                      unit={unit}
                    />
                  ))}
                  {loading && <StateCard loading />}
                  {!allTx && items.length > TX_PREVIEW ? (
                    <Btn secondary onPress={() => setAllTx(true)}>
                      더보기
                    </Btn>
                  ) : (
                    page < (meta?.total_pages ?? 1) && (
                      <Btn
                        secondary
                        disabled={loading}
                        onPress={() => {
                          setLoading(true);
                          setPage((v) => v + 1);
                        }}
                      >
                        거래 더 보기
                      </Btn>
                    )
                  )}
                </Section>
                <NearbySchoolsSection complexId={complex.id} repo={repo} />
              </View>
              <View style={{ flex: twoColumns ? 1 : undefined, minWidth: 0 }}>
                <Section
                  title="용도지역 요약"
                  right={<Help onPress={() => onHelp("용도지역")} />}
                >
                  {analysisError ? (
                    <StateCard
                      error={analysisError}
                      onRetry={() => setAnalysisRetry((x) => x + 1)}
                    />
                  ) : analysis?.zonings?.length ? (
                    analysis.zonings.map((zone, i) => (
                      <View
                        key={`${zone.zone_type}-${i}`}
                        style={[
                          s.card,
                          {
                            backgroundColor: C.landWash,
                            borderColor: C.land,
                            gap: 8,
                          },
                        ]}
                      >
                        <T bold color={C.land}>
                          {zone.zone_type}
                        </T>
                        <T size={14}>
                          {zone.inclusion}
                          {zone.area_ratio != null
                            ? ` · ${(zone.area_ratio * 100).toFixed(0)}%`
                            : ""}
                        </T>
                        <T>
                          건폐율{" "}
                          {zone.max_building_coverage_ratio == null
                            ? "정보 없음"
                            : `${zone.max_building_coverage_ratio}%`}{" "}
                          · 용적률{" "}
                          {zone.max_floor_area_ratio == null
                            ? "정보 없음"
                            : `${zone.max_floor_area_ratio}%`}
                        </T>
                      </View>
                    ))
                  ) : (
                    <T size={14} color={C.light}>
                      필지 정보를 확보한 뒤 용도지역을 보여드릴 수 있어요.
                    </T>
                  )}
                  {analysis?.disclaimer && (
                    <T size={12} color={C.muted}>
                      {analysis.disclaimer}
                    </T>
                  )}
                </Section>
              </View>
            </View>
          )}
          <Pressable
            onPress={() => notify("중개사 연결은 보류 중이에요")}
            accessibilityRole="button"
            style={[s.card, { marginTop: 16, borderStyle: "dashed" }]}
          >
            <T size={15} color={C.light}>
              ⏸ 주변 중개사 연결 · 보류
            </T>
          </Pressable>
          <Notice date={meta?.data_as_of} mode={meta?.data_mode ?? repo.mode} />
        </>
      )}
    </>
  );
}
