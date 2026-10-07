import React, { useEffect, useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import type { Repository } from "../api/repository";
import type {
  BBox,
  Complex,
  Filters,
  Sort,
  Transaction,
  Meta,
} from "../api/types";
import { TransactionRow } from "../components/TransactionRow";
import { Btn, Chip, Header, Notice, StateCard, T, s } from "../components/ui";
import { C } from "../theme/tokens";
export function TransactionsScreen({
  repo,
  filters,
  bbox,
  region,
  regionName,
  onBack,
  onComplex,
  unit,
}: {
  repo: Repository;
  filters: Filters;
  bbox: BBox;
  region?: string;
  regionName?: string;
  onBack: () => void;
  onComplex: (id: string) => void;
  unit: "평" | "㎡";
}) {
  const [sort, setSort] = useState<Sort>("contract_date_desc");
  const [cancelled, setCancelled] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Transaction[]>([]);
  const [meta, setMeta] = useState<Meta>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const a = new AbortController();
    setLoading(true);
    setError(null);
    repo
      .transactions(filters, { bbox, region, sort, cancelled, page }, a.signal)
      .then((r) => {
        if (!a.signal.aborted) {
          setItems((v) => (page === 1 ? r.data : [...v, ...r.data]));
          setMeta(r.meta);
        }
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!a.signal.aborted) setLoading(false);
      });
    return () => a.abort();
  }, [repo, filters, bbox, region, sort, cancelled, page, retry]);
  return (
    <View style={s.screen}>
      <Header title="거래 목록" onBack={onBack} />
      <View style={{ padding: 16, gap: 12 }}>
        <T color={C.muted}>{regionName ?? "현재 지도 영역"}</T>
        <View style={[s.row, { gap: 5 }]}>
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
        <View style={s.between}>
          <T size={15}>해제 거래 포함</T>
          <Switch
            accessibilityLabel="해제 거래 포함"
            value={cancelled}
            onValueChange={(v) => {
              setCancelled(v);
              setPage(1);
            }}
            trackColor={{ true: C.primary }}
          />
        </View>
      </View>
      <Notice date={meta?.data_as_of} mode={meta?.data_mode} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
      >
        {items.map((tx) => (
          <TransactionRow
            key={tx.id}
            tx={tx}
            unit={unit}
            name={tx.address}
            onPress={
              tx.complex_id ? () => onComplex(tx.complex_id!) : undefined
            }
          />
        ))}
        {loading || error ? (
          <StateCard
            loading={loading}
            error={error}
            onRetry={() => setRetry((x) => x + 1)}
          />
        ) : items.length === 0 ? (
          <StateCard empty="조건에 맞는 거래가 없어요" />
        ) : page < (meta?.total_pages ?? 1) ? (
          <Btn
            secondary
            disabled={loading}
            onPress={() => {
              setLoading(true);
              setPage((x) => x + 1);
            }}
            style={{ marginTop: 18 }}
          >
            거래 더 보기
          </Btn>
        ) : (
          <T
            size={14}
            color={C.light}
            style={{ textAlign: "center", padding: 18 }}
          >
            거래 {meta?.total ?? items.length}건을 모두 확인했어요
          </T>
        )}
      </ScrollView>
      <View style={{ padding: 16, borderTopWidth: 1, borderColor: C.rule }}>
        <Btn secondary icon="map" onPress={onBack}>
          지도로 보기
        </Btn>
      </View>
    </View>
  );
}
