import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import type { Repository } from "../api/repository";
import type {
  Analysis,
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
  s,
} from "../components/ui";
import { Chart } from "../components/Chart";
import { TransactionRow } from "../components/TransactionRow";
import type { SheetStage } from "../components/Sheet";
export function RegionContent({
  marker,
  filters,
  repo,
  onList,
  onComplex,
  onHelp,
  date,
  unit,
}: {
  marker: RegionMarker;
  filters: Filters;
  repo: Repository;
  onList: () => void;
  onComplex: (id: string) => void;
  onHelp: (name: string) => void;
  date?: string;
  unit: "평" | "㎡";
}) {
  const [stats, setStats] = useState<Stats | null>(null);
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
    Promise.allSettled([
      repo.stats(filters, marker.region_code, "region", a.signal),
      repo.transactions(filters, { region: marker.region_code }, a.signal),
    ]).then(([st, tx]) => {
      if (a.signal.aborted) return;
      if (st.status === "fulfilled") setStats(st.value.data);
      if (tx.status === "fulfilled") setItems(tx.value.data.slice(0, 4));
      if (st.status === "rejected" || tx.status === "rejected")
        setError("지역 통계·거래 목록 API가 준비 중이에요");
      setLoading(false);
    });
    return () => a.abort();
  }, [repo, filters, marker.region_code, retry]);
  return (
    <>
      <T size={22} bold>
        {marker.name}
      </T>
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
            {markerLabel(marker).replace("평당 ", "")}
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
            {marker.transaction_count.toLocaleString()}건
          </T>
        </View>
      </View>
      <Section title="월별 평당가 (중위값)">
        {stats ? (
          <Chart trend={stats.trend} bar />
        ) : loading ? (
          <StateCard loading />
        ) : (
          <T size={14} color={C.light}>
            지역 통계 API가 준비 중이에요
          </T>
        )}
      </Section>
      <Section title="최근 거래">
        {items.map((tx) => (
          <TransactionRow
            tx={tx}
            key={tx.id}
            unit={unit}
            name={tx.address}
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
      <View style={[s.card, { borderStyle: "dashed" }]}>
        <T color={C.light} size={14}>
          주변 중개사 목록은 2차에서 열려요
        </T>
      </View>
      <Notice date={date} mode={repo.mode} />
    </>
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
}: {
  id: string;
  repo: Repository;
  filters: Filters;
  stage: SheetStage;
  onStage: (s: SheetStage) => void;
  onHelp: (name: string) => void;
  notify: (s: string) => void;
  unit: "평" | "㎡";
}) {
  const [complex, setComplex] = useState<Complex | null>(null);
  const [items, setItems] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [meta, setMeta] = useState<Meta>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [sort, setSort] = useState<Sort>("contract_date_desc");
  const [cancelled, setCancelled] = useState(false);
  const [area, setArea] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
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
  }, [id, repo, filters, sort, cancelled, page, area, retry]);
  useEffect(() => {
    const a = new AbortController();
    setStats(null);
    setAnalysis(null);
    setStatsError(false);
    repo
      .stats(filters, id, "complex", a.signal)
      .then((r) => {
        if (!a.signal.aborted) setStats(r.data);
      })
      .catch(() => {
        if (!a.signal.aborted) setStatsError(true);
      });
    repo
      .analysis(id, a.signal)
      .then((r) => {
        if (!a.signal.aborted) setAnalysis(r.data);
      })
      .catch(() => {});
    return () => a.abort();
  }, [id, repo, filters, retry]);
  if (!complex || error)
    return (
      <StateCard
        loading={loading}
        error={error}
        onRetry={() => setRetry((x) => x + 1)}
      />
    );
  const tx = items[0];
  const a =
    complex.area_types.find((a) => a.exclusive_area_m2 === area) ??
    complex.area_types[0];
  return (
    <>
      <View style={s.between}>
        <T size={stage === "full" ? 24 : 21} bold style={{ flex: 1 }}>
          {complex.name}
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="관심 단지 등록"
          onPress={() => notify("관심 등록은 2차에서 열려요")}
          style={{
            padding: 12,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: C.disabled,
            borderRadius: 12,
          }}
        >
          <Icon name="star" color={C.light} />
        </Pressable>
      </View>
      <T size={14} color={C.muted}>
        {PROPERTY[complex.property_type]} ·{" "}
        {complex.address.replace("부산광역시 ", "")}
      </T>
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
          <T size={14} color={C.muted} style={{ marginVertical: 8 }}>
            {complex.build_year
              ? `${complex.build_year}년 준공`
              : "준공연도 정보 없음"}{" "}
            ·{" "}
            {complex.household_count
              ? `${complex.household_count.toLocaleString()}세대`
              : "세대수 정보 없음"}
          </T>
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
            title="평당가 추이 · 최근 3년"
            right={<Help onPress={() => onHelp("평당가")} />}
          >
            {stats ? (
              <Chart trend={stats.trend} comparison={repo.mode === "sample"} />
            ) : (
              <T size={14} color={C.light}>
                {statsError
                  ? "시세 통계 API가 준비 중이에요"
                  : "시세 추이를 불러오는 중…"}
              </T>
            )}
          </Section>
          {stage === "half" ? (
            <Btn onPress={() => onStage("full")}>자세히 보기</Btn>
          ) : (
            <>
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
                {items.map((t) => (
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
                {page < (meta?.total_pages ?? 1) && (
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
                )}
              </Section>
              <Section
                title="용도지역 요약"
                right={<Help onPress={() => onHelp("용도지역")} />}
              >
                {analysis?.zoning_summary ? (
                  <View
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
                      {analysis.zoning_summary.zone_type}
                    </T>
                    <T>{analysis.zoning_summary.plain_explanation}</T>
                    <T bold>
                      건폐율{" "}
                      {analysis.zoning_summary.max_building_coverage_ratio}% ·
                      용적률 {analysis.zoning_summary.max_floor_area_ratio}%
                    </T>
                    <T size={12} color={C.muted}>
                      출처 · {analysis.zoning_summary.ratio_source}
                    </T>
                  </View>
                ) : (
                  <T size={14} color={C.light}>
                    분석 API가 준비 중이에요
                  </T>
                )}
              </Section>
            </>
          )}
          <Pressable
            onPress={() => notify("중개사 문의는 2차에서 열려요")}
            accessibilityRole="button"
            style={[s.card, { marginTop: 16, borderStyle: "dashed" }]}
          >
            <T size={15} color={C.light}>
              주변 중개사에게 문의 · 2차
            </T>
          </Pressable>
          <Notice date={meta?.data_as_of} mode={meta?.data_mode ?? repo.mode} />
        </>
      )}
    </>
  );
}
