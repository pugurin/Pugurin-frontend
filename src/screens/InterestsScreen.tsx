import React, { useContext, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { Repository } from "../api/repository";
import type {
  Auction,
  AuctionInterest,
  ComplexInterest,
  InterestKind,
  Meta,
  RegionInterest,
} from "../api/types";
import { StarButton } from "../components/StarButton";
import { Chip, Header, StateCard, T, s } from "../components/ui";
import { auctionSourceLine, auctionTitle } from "../state/auction";
import { InterestsContext } from "../state/interests";
import { PROPERTY, formatArea, priceLabel } from "../state/market";
import { C } from "../theme/tokens";
import { AuctionRow } from "./AuctionsScreen";

// 더보기 → 관심 단지·경매·지역 목록. 최근에 담은 것부터 보이고, ★를 끄면 그 줄을 바로 뺀다
export function InterestsScreen({
  repo,
  initialTab,
  unit,
  onBack,
  onComplex,
  onAuction,
  onRegion,
}: {
  repo: Repository;
  initialTab: InterestKind;
  unit: "평" | "㎡";
  onBack: () => void;
  onComplex: (id: string) => void;
  onAuction: (a: Auction) => void;
  // 지역 줄을 누르면 그 동네 좌표로 지도를 옮긴다. 좌표가 없는 줄은 누를 수 없다
  onRegion?: (p: { lat: number; lng: number }) => void;
}) {
  const { has, learn, count } = useContext(InterestsContext);
  const [tab, setTab] = useState(initialTab);
  const [complexes, setComplexes] = useState<ComplexInterest[]>([]);
  const [auctions, setAuctions] = useState<AuctionInterest[]>([]);
  const [regions, setRegions] = useState<RegionInterest[]>([]);
  const [meta, setMeta] = useState<Meta>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const a = new AbortController();
    setLoading(true);
    setError(null);
    const done = () => {
      if (!a.signal.aborted) setLoading(false);
    };
    const fail = (e: Error) => {
      if (!a.signal.aborted) setError(e.message);
    };
    if (tab === "complex")
      repo
        .complexInterests(a.signal)
        .then((r) => {
          if (a.signal.aborted) return;
          learn(
            "complex",
            r.data.map((c) => c.complex.id),
          );
          setComplexes(r.data);
        })
        .catch(fail)
        .finally(done);
    else if (tab === "region")
      repo
        .regionInterests(a.signal)
        .then((r) => {
          if (a.signal.aborted) return;
          learn(
            "region",
            r.data.map((x) => x.code),
          );
          setRegions(r.data);
        })
        .catch(fail)
        .finally(done);
    else
      repo
        .auctionInterests(a.signal)
        .then((r) => {
          if (a.signal.aborted) return;
          learn(
            "auction",
            r.data.map((x) => x.auction.id),
          );
          setAuctions(r.data);
          setMeta(r.meta);
        })
        .catch(fail)
        .finally(done);
    return () => a.abort();
  }, [repo, tab, retry]);
  // 별을 끈 줄은 바로 뺀다
  const shownComplexes = complexes.filter((c) => has("complex", c.complex.id));
  const shownAuctions = auctions.filter((x) => has("auction", x.auction.id));
  const shownRegions = regions.filter((r) => has("region", r.code));
  const empty =
    tab === "complex"
      ? shownComplexes.length === 0
      : tab === "region"
        ? shownRegions.length === 0
        : shownAuctions.length === 0;
  const sourceLine =
    tab === "auction" ? auctionSourceLine(meta, repo.mode) : "";
  return (
    <View style={s.screen}>
      <Header title="관심 목록" onBack={onBack} />
      <View style={[s.row, { gap: 6, paddingHorizontal: 16, paddingTop: 8 }]}>
        <Chip selected={tab === "complex"} onPress={() => setTab("complex")}>
          {`관심 단지 ${count.complex}`}
        </Chip>
        <Chip selected={tab === "auction"} onPress={() => setTab("auction")}>
          {`관심 경매 ${count.auction}`}
        </Chip>
        <Chip selected={tab === "region"} onPress={() => setTab("region")}>
          {`관심 지역 ${count.region}`}
        </Chip>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      >
        {loading || error ? (
          <StateCard
            loading={loading}
            error={error}
            onRetry={() => setRetry((x) => x + 1)}
          />
        ) : empty ? (
          <StateCard
            empty={
              tab === "complex"
                ? "단지 시트에서 ☆를 눌러 담아 보세요"
                : tab === "region"
                  ? "동네 시트에서 ☆를 눌러 담아 보세요"
                  : "경매 시트에서 ☆를 눌러 담아 보세요"
            }
          />
        ) : tab === "complex" ? (
          shownComplexes.map((c) => (
            <ComplexRow
              key={c.complex.id}
              c={c}
              unit={unit}
              onPress={() => onComplex(c.complex.id)}
            />
          ))
        ) : tab === "region" ? (
          shownRegions.map((r) => (
            <RegionRow
              key={r.code}
              r={r}
              onPress={
                r.lat != null && r.lng != null && onRegion
                  ? () => onRegion({ lat: r.lat!, lng: r.lng! })
                  : undefined
              }
            />
          ))
        ) : (
          shownAuctions.map((x) => (
            <AuctionRow
              key={x.auction.id}
              a={x.auction}
              unit={unit}
              onPress={() => onAuction(x.auction)}
              trailing={
                <StarButton
                  kind="auction"
                  id={x.auction.id}
                  name={auctionTitle(x.auction)}
                />
              }
            />
          ))
        )}
      </ScrollView>
      <View
        style={{ padding: 16, gap: 6, borderTopWidth: 1, borderColor: C.rule }}
      >
        {sourceLine !== "" && (
          <T size={13} color={C.muted} style={{ textAlign: "center" }}>
            {sourceLine}
          </T>
        )}
        <T size={13} color={C.light} style={{ textAlign: "center" }}>
          관심 목록은 내 계정에 저장돼요
        </T>
      </View>
    </View>
  );
}

function ComplexRow({
  c,
  unit,
  onPress,
}: {
  c: ComplexInterest;
  unit: "평" | "㎡";
  onPress: () => void;
}) {
  const { complex, latest_sale: tx } = c;
  return (
    <View
      style={[s.row, { gap: 10, borderBottomWidth: 1, borderColor: C.rule }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${complex.name} 지도에서 보기`}
        onPress={onPress}
        style={{ flex: 1, paddingVertical: 14, gap: 4 }}
      >
        <T bold size={17}>
          {complex.name}
        </T>
        <T size={14} color={C.muted}>
          {PROPERTY[complex.property_type]} ·{" "}
          {complex.address.replace("부산광역시 ", "")}
        </T>
        {tx ? (
          <T size={15}>
            <T bold size={15}>
              최근 매매 {priceLabel(tx)}
            </T>
            {` · ${formatArea(tx, unit)} · ${tx.contract_date.replaceAll("-", ".")}`}
          </T>
        ) : (
          <T size={15} color={C.light}>
            최근 매매 정보 없음
          </T>
        )}
      </Pressable>
      <StarButton kind="complex" id={complex.id} name={complex.name} />
    </View>
  );
}

function RegionRow({
  r,
  onPress,
}: {
  r: RegionInterest;
  onPress?: () => void;
}) {
  const body = (
    <>
      <T bold size={17}>
        {r.name}
      </T>
      <T size={14} color={C.muted}>
        {r.sigungu_name}
      </T>
    </>
  );
  return (
    <View
      style={[s.row, { gap: 10, borderBottomWidth: 1, borderColor: C.rule }]}
    >
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${r.name} 지도에서 보기`}
          onPress={onPress}
          style={{ flex: 1, paddingVertical: 14, gap: 4 }}
        >
          {body}
        </Pressable>
      ) : (
        <View style={{ flex: 1, paddingVertical: 14, gap: 4 }}>{body}</View>
      )}
      <StarButton kind="region" id={r.code} name={r.name} />
    </View>
  );
}
