import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { Repository } from "../api/repository";
import type {
  BBox,
  Filters,
  Meta,
  Parcel,
  Stats,
  Transaction,
} from "../api/types";
import { changeProperty } from "../state/market";
import { C } from "../theme/tokens";
import { LoadingTip } from "../components/LoadingTip";
import { Btn, Help, Notice, T, s } from "../components/ui";

const amount = (value: number | null | undefined) =>
  value == null
    ? "정보 없음"
    : `${(value / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}만`;
const number = (value: number) =>
  value.toLocaleString("ko-KR", { maximumFractionDigits: 1 });

export function LandContent({
  repo,
  filters,
  bbox,
  region,
  parcel,
  loading = false,
  error,
  onRetry,
  onList,
  onHelp,
  unit,
}: {
  repo: Repository;
  filters: Filters;
  bbox: BBox;
  region?: { code: string; name: string };
  parcel: Parcel | null;
  loading?: boolean;
  error?: string | null;
  onRetry: () => void;
  onList: () => void;
  onHelp: (name: string) => void;
  unit: "평" | "㎡";
}) {
  const landFilters=useMemo(()=>changeProperty(filters,"land"),[filters]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>();
  const [meta, setMeta] = useState<Meta>();
  const [txError, setTxError] = useState<string>();
  const [statsError, setStatsError] = useState<string>();
  const [txBusy, setTxBusy] = useState(true);
  const [statsBusy, setStatsBusy] = useState(false);
  const [txRetry, setTxRetry] = useState(0);
  const [statsRetry, setStatsRetry] = useState(0);
  const busy = txBusy || statsBusy;
  const regionCode = region?.code;
  const boxKey = bbox.join(",");
  useEffect(() => {
    const controller = new AbortController();
    setTxBusy(true);
    setTransactions([]);
    setTxError(undefined);
    repo
      .transactions(
        landFilters,
        { region: regionCode, bbox: regionCode ? undefined : bbox },
        controller.signal,
      )
      .then((r) => {
        if (!controller.signal.aborted) {
          setTransactions(r.data);
          setMeta(r.meta);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setTxError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTxBusy(false);
      });
    return () => controller.abort();
  }, [repo, filters, regionCode, boxKey, txRetry]);
  useEffect(() => {
    const controller = new AbortController();
    setStats(undefined);
    setStatsError(undefined);
    if (!regionCode) {
      setStatsBusy(false);
      return;
    }
    setStatsBusy(true);
    repo
      .stats(landFilters, regionCode, "region", controller.signal)
      .then((r) => {
        if (!controller.signal.aborted) {
          setStats(r.data);
          if (r.meta) setMeta(r.meta);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setStatsError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setStatsBusy(false);
      });
    return () => controller.abort();
  }, [repo, filters, regionCode, statsRetry]);
  const title = parcel?.jibun_address ?? region?.name ?? "선택한 지도 영역";
  const nonBuilding =
    parcel?.land_category &&
    ["도로", "하천", "구거", "제방"].includes(parcel.land_category);
  const validTrend =
    stats?.trend.filter((p) => p.median_price_per_pyeong != null) ?? [];
  const max = Math.max(1, ...validTrend.map((p) => p.median_price_per_pyeong!));
  const retryStats = () => setStatsRetry((value) => value + 1);
  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 6 }}>
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: C.landWash,
            borderRadius: 6,
            paddingHorizontal: 9,
            paddingVertical: 4,
          }}
        >
          <T size={13} bold color={C.land}>
            토지 · 매매
          </T>
        </View>
        <T size={24} bold>
          {title}
        </T>
      </View>
      <LoadingTip
        loading={loading || busy}
        context="land"
        error={!!error || !!txError || !!statsError}
      />
      {loading ? (
        <View style={[s.row, { paddingVertical: 18 }]}>
          <ActivityIndicator />
          <T>토지 정보 확인 중…</T>
        </View>
      ) : error ? (
        <View style={s.card}>
          <T bold>{error}</T>
          <Btn secondary small onPress={onRetry}>
            다시 시도
          </Btn>
        </View>
      ) : !parcel ? (
        <View style={[s.card, { backgroundColor: C.bg2, gap: 6 }]}>
          <T size={18} bold>
            토지 정보를 잠시 불러올 수 없어요
          </T>
          <T size={15} color={C.muted}>
            지목 · 공시지가 · 용도지역은 아직 볼 수 없어요. 지도는 계속 쓸 수
            있어요.
          </T>
        </View>
      ) : (
        <>
          <T size={21} bold>
            기본 정보
          </T>
          <InfoRow
            title="지목"
            value={parcel.land_category ?? "정보 없음"}
            onHelp={onHelp}
          />
          <InfoRow
            title="토지면적"
            value={
              unit === "평"
                ? parcel.land_area_pyeong == null
                  ? "정보 없음"
                  : `${number(parcel.land_area_pyeong)}평`
                : parcel.land_area_m2 == null
                  ? "정보 없음"
                  : `${number(parcel.land_area_m2)}㎡`
            }
            detail={
              unit === "평" && parcel.land_area_m2 != null
                ? `${number(parcel.land_area_m2)}㎡`
                : undefined
            }
          />
          <InfoRow
            title="공시지가"
            value={
              parcel.official_land_price_per_m2 == null
                ? "정보 없음"
                : `㎡당 ${amount(parcel.official_land_price_per_m2)}`
            }
            detail={
              parcel.official_land_price_year == null
                ? undefined
                : `${parcel.official_land_price_year}년 기준`
            }
            onHelp={onHelp}
          />
          <InfoRow
            title="도로접면"
            value={parcel.road_side ?? "정보 없음"}
            onHelp={onHelp}
          />
          <InfoRow title="모양" value={parcel.shape ?? "정보 없음"} />
          {nonBuilding ? (
            <View style={[s.card, { backgroundColor: C.landWash }]}>
              <T>
                {parcel.land_category} 지목은 여기서 건축 규모를 계산하지 않아요.
              </T>
            </View>
          ) : (
            <>
              <T size={21} bold>
                이 땅에 뭘 지을 수 있나요
              </T>
              {parcel.zonings?.length ? (
                <>
                  {parcel.zonings.map((zone, i) => (
                    <View
                      key={`${zone.zone_type}-${i}`}
                      style={[s.card, { gap: 8 }]}
                    >
                      <T size={19} bold>
                        {zone.zone_type}
                      </T>
                      <T size={14} color={C.muted}>
                        {zone.inclusion}
                        {zone.area_ratio == null
                          ? ""
                          : ` · 면적 비율 ${number(zone.area_ratio * 100)}%`}
                      </T>
                      <InfoRow
                        title="건폐율"
                        value={
                          zone.max_building_coverage_ratio == null
                            ? "정보 없음"
                            : `최대 ${zone.max_building_coverage_ratio}%`
                        }
                        onHelp={onHelp}
                      />
                      <InfoRow
                        title="용적률"
                        value={
                          zone.max_floor_area_ratio == null
                            ? "정보 없음"
                            : `최대 ${zone.max_floor_area_ratio}%`
                        }
                        onHelp={onHelp}
                      />
                    </View>
                  ))}
                  {parcel.ratio_source && (
                    <T size={13} color={C.muted}>
                      {parcel.ratio_source}
                    </T>
                  )}
                  <T size={14} color={C.muted}>
                    건폐율 · 용적률은 조례 기준이에요. 실제 건축 가능 규모는
                    도로와 규제를 함께 확인해야 해요.
                  </T>
                </>
              ) : (
                <View style={[s.card, { gap: 8 }]}>
                  <T bold>용도지역 · 규제를 불러오지 못했어요</T>
                  <T size={15} color={C.muted}>
                    기본 정보와 땅값은 그대로 볼 수 있어요.
                  </T>
                  <Btn small secondary onPress={onRetry}>
                    다시 시도
                  </Btn>
                </View>
              )}
              {!!parcel.restrictions?.length && (
                <>
                  <T size={21} bold>
                    함께 확인할 규제
                  </T>
                  {parcel.restrictions.map((restriction) => (
                    <View key={restriction.name} style={{ gap: 4 }}>
                      <LabelHelp
                        title={restriction.name}
                        onPress={() => onHelp(restriction.name)}
                      />
                      <T size={15} color={C.muted}>
                        {restriction.plain_explanation}
                      </T>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </>
      )}
      <View
        style={{
          gap: 12,
          paddingTop: 16,
          borderTopWidth: 1,
          borderColor: C.rule,
        }}
      >
        <T size={21} bold>
          {region?.name ?? "지도 영역"} 토지 거래
        </T>
        <T size={14} color={C.muted}>
          최근 {filters.period_months}개월 · 해제 거래 제외
        </T>
        <LabelHelp title="지목" onPress={() => onHelp("지목")} />
        <T size={14} color={C.muted}>
          지목별 조회는 아직 지원하지 않아 전체 토지 거래를 보여줘요.
        </T>
        {statsBusy ? (
          <ActivityIndicator />
        ) : statsError ? (
          <View style={{ gap: 8 }}>
            <T color={C.muted}>{statsError}</T>
            <Btn secondary small onPress={retryStats}>
              통계 다시 시도
            </Btn>
          </View>
        ) : stats ? (
          <View style={[s.row, { alignItems: "stretch", gap: 12 }]}>
            <View style={[s.card, { flex: 1, gap: 5 }]}>
              <LabelHelp
                title="평당가 중위값"
                onPress={() => onHelp("중위값")}
              />
              <T size={22} bold>
                {amount(stats.median_price_per_pyeong)}
              </T>
              <T size={12} color={C.muted}>
                전체 지목 기준
              </T>
            </View>
            <View style={[s.card, { flex: 1, gap: 5 }]}>
              <T size={14} color={C.muted}>
                거래
              </T>
              <T size={22} bold>
                {stats.transaction_count}건
              </T>
              <T size={12} color={C.muted}>
                해제 거래 제외
              </T>
            </View>
          </View>
        ) : (
          <T size={15} color={C.muted}>
            지역을 선택하면 동 단위 통계를 볼 수 있어요.
          </T>
        )}
        {!!validTrend.length && (
          <View style={{ gap: 8 }}>
            <T size={18} bold>
              월별 토지 땅값
            </T>
            <T size={13} color={C.muted}>
              서버 제공 평당가 중위값 · 전체 지목
            </T>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                height: 132,
                gap: 6,
              }}
            >
              {validTrend.map((point) => (
                <View
                  key={point.month}
                  style={{ flex: 1, alignItems: "center", gap: 4 }}
                >
                  <T size={11} numberOfLines={1}>
                    {amount(point.median_price_per_pyeong)}
                  </T>
                  <View
                    style={{
                      width: "100%",
                      height: Math.max(
                        8,
                        (point.median_price_per_pyeong! / max) * 82,
                      ),
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      backgroundColor: C.land,
                    }}
                  />
                  <T size={11}>{point.month.slice(5)}월</T>
                </View>
              ))}
            </View>
          </View>
        )}
        <T size={14} color={C.muted}>
          토지 거래는 지번이 가려져 있어 동 단위로만 보여줘요.
        </T>
        <T size={18} bold>
          최근 토지 거래
        </T>
        {txError ? (
          <View style={{ gap: 8 }}>
            <T color={C.muted}>{txError}</T>
            <Btn
              secondary
              small
              onPress={() => setTxRetry((value) => value + 1)}
            >
              거래 다시 시도
            </Btn>
          </View>
        ) : !txBusy && !transactions.length ? (
          <T size={15} color={C.muted}>
            이 조건의 토지 거래가 없어요.
          </T>
        ) : (
          transactions.slice(0, 5).map((tx) => (
            <View
              key={tx.id}
              style={{
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderColor: C.rule,
                gap: 4,
              }}
            >
              <View style={s.between}>
                <T bold>{tx.address}</T>
                <T bold color={C.land}>
                  {amount(tx.price)}
                </T>
              </View>
              <T size={13} color={C.muted}>
                {tx.contract_date} · 평당 {amount(tx.price_per_pyeong)}
              </T>
            </View>
          ))
        )}
        <Btn secondary icon="list" onPress={onList}>
          토지 거래 목록 보기
        </Btn>
        <T size={13} color={C.light}>
          실거래가 기준 {meta?.data_as_of ?? "확인 중"} · 최근 30일 거래는 아직
          신고되지 않았을 수 있어요
        </T>
      </View>
    </View>
  );
}
function InfoRow({
  title,
  value,
  detail,
  onHelp,
}: {
  title: string;
  value: string;
  detail?: string;
  onHelp?: (name: string) => void;
}) {
  return (
    <View
      style={{
        gap: 4,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderColor: C.rule,
      }}
    >
      {onHelp ? (
        <LabelHelp title={title} onPress={() => onHelp(title)} />
      ) : (
        <T size={14} color={C.muted}>
          {title}
        </T>
      )}
      <T size={19} bold>
        {value}
      </T>
      {detail && (
        <T size={14} color={C.muted}>
          {detail}
        </T>
      )}
    </View>
  );
}

function LabelHelp({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <View style={s.row}>
      <T size={14} color={C.muted}>
        {title}
      </T>
      <Help onPress={onPress} />
    </View>
  );
}
