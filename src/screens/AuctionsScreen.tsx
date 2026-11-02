import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import type { Repository } from "../api/repository";
import type {
  Auction,
  AuctionQuery,
  AuctionSource,
  BBox,
  Meta,
  Property,
} from "../api/types";
import { Badge, SHARE_INK, SHARE_WASH, areaOf } from "./AuctionContent";
import { Btn, Chip, Header, Section, StateCard, T, s } from "../components/ui";
import {
  AUCTION_SERVER_SORT,
  auctionSourceLine,
  compareLine,
  dday,
  formatWon,
  ratioLine,
  auctionTitle,
} from "../state/auction";
import { C } from "../theme/tokens";

const PAGE_SIZE = 50;
// 끝에서 이만큼(px) 안쪽으로 들어오면 다음 쪽을 부른다
const LOAD_MORE_MARGIN = 240;

type Sort = NonNullable<AuctionQuery["sort"]>;
const SORTS: readonly (readonly [Sort, string])[] = [
  ["sale_date", "입찰일 가까운 순"],
  ["min_price_ratio", "감정가 대비 낮은 순"],
  ["min_price", "최저가 낮은 순"],
  ["recent_trade_discount", "실거래 대비 많이 싼 순"],
];
const GROUPS: readonly (readonly [Property | "all", string])[] = [
  ["all", "전체"],
  ["apartment", "아파트"],
  ["officetel", "오피스텔"],
  ["villa", "빌라"],
  ["land", "토지"],
];
const SOURCES: readonly (readonly [AuctionSource | undefined, string])[] = [
  [undefined, "법원경매+공매"],
  ["court", "법원경매만"],
  ["public", "공매만"],
];
const NOT_READY = "경매 정보를 준비 중이에요";

function AuctionRow({
  a,
  unit,
  onPress,
}: {
  a: Auction;
  unit: "평" | "㎡";
  onPress: () => void;
}) {
  const d = dday(a, new Date());
  const compare = compareLine(a);
  const area = [a.usage, areaOf(a, unit)].filter(Boolean).join(" · ");
  const priceLine = [
    ratioLine(a),
    a.fail_count != null ? `유찰 ${a.fail_count}회` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingVertical: 14,
          gap: 5,
          borderBottomWidth: 1,
          borderColor: C.rule,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={s.between}>
        <T size={17} bold style={{ flex: 1 }} numberOfLines={1}>
          {auctionTitle(a)}
        </T>
        {d && (
          <Badge
            bg={d.soon ? C.brownWash : C.bg2}
            ink={d.soon ? C.brownInk : C.ink2}
          >
            {d.label}
          </Badge>
        )}
      </View>
      <T size={19} bold>
        {a.min_price == null
          ? "최저가 미정"
          : `최저가 ${formatWon(a.min_price)}`}
      </T>
      <T
        size={14}
        bold={compare?.good}
        color={compare?.good ? C.greenInk : C.muted}
      >
        {compare?.text ?? "실거래 비교 없음"}
      </T>
      <View style={[s.row, { flexWrap: "wrap", gap: 6 }]}>
        <Badge>{a.source === "public" ? "공매" : "법원경매"}</Badge>
        {a.is_share && (
          <Badge bg={SHARE_WASH} ink={SHARE_INK}>
            지분
          </Badge>
        )}
        {a.is_closed && <Badge>끝난 경매</Badge>}
        {area !== "" && (
          <T size={14} color={C.muted}>
            {area}
          </T>
        )}
      </View>
      {priceLine !== "" && (
        <T size={14} color={C.muted}>
          {priceLine}
        </T>
      )}
    </Pressable>
  );
}

export function AuctionsScreen({
  repo,
  bbox,
  property,
  complexId,
  name,
  unit = "평",
  onBack,
  onAuction,
}: {
  repo: Repository;
  bbox: BBox;
  // 유형 칩의 처음 선택. 지도의 현재 물건 탭
  property: Property;
  // 있으면 이 단지의 경매만 본다 (지도 범위·유형 칩은 쓰지 않는다)
  complexId?: string;
  name?: string;
  unit?: "평" | "㎡";
  onBack: () => void;
  onAuction: (a: Auction) => void;
}) {
  const [sort, setSort] = useState<Sort>("sale_date");
  const [group, setGroup] = useState<Property | "all">(property);
  const [source, setSource] = useState<AuctionSource | undefined>();
  const [includeClosed, setIncludeClosed] = useState(false);
  const [excludeShare, setExcludeShare] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Auction[]>([]);
  const [meta, setMeta] = useState<Meta>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(
    null,
  );
  const [retry, setRetry] = useState(0);
  // 서버가 오래된 버전이면 recent_trade_price 키가 없다. 한 번이라도 보이면 계속 보인다
  const [hasTrade, setHasTrade] = useState(false);
  // 다음 쪽 요청을 낸 뒤 응답이 올 때까지 스크롤 이벤트가 또 부르지 못하게 한다
  const paging = useRef(false);
  const serverSort = AUCTION_SERVER_SORT;
  useEffect(() => {
    const a = new AbortController();
    setLoading(true);
    setError(null);
    if (page === 1) setItems([]);
    repo
      .auctions(
        {
          ...(complexId
            ? { complexId }
            : {
                bbox,
                groups: group === "all" ? undefined : [group],
              }),
          source,
          includeClosed: includeClosed || undefined,
          page,
          pageSize: PAGE_SIZE,
          ...(serverSort
            ? { sort, excludeShare: excludeShare || undefined }
            : {}),
        },
        a.signal,
      )
      .then((r) => {
        if (a.signal.aborted) return;
        setItems((v) => (page === 1 ? r.data : [...v, ...r.data]));
        setMeta(r.meta);
        if (page === 1 && r.data.some((x) => "recent_trade_price" in x))
          setHasTrade(true);
      })
      .catch((e) => {
        if (!a.signal.aborted)
          setError({
            message: e?.message ?? "불러오지 못했어요",
            code: e?.code,
          });
      })
      .finally(() => {
        if (!a.signal.aborted) {
          setLoading(false);
          paging.current = false;
        }
      });
    return () => a.abort();
  }, [
    repo,
    bbox,
    complexId,
    group,
    source,
    includeClosed,
    excludeShare,
    sort,
    serverSort,
    page,
    retry,
  ]);
  // 정렬·유형·필터를 바꾸면 1쪽부터 다시 부른다
  const change = (apply: () => void) => {
    paging.current = false;
    apply();
    setPage(1);
  };
  const totalPages = meta?.total_pages ?? 1;
  const loadMore = (e: {
    nativeEvent: {
      contentOffset: { y: number };
      contentSize: { height: number };
      layoutMeasurement: { height: number };
    };
  }) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (
      contentOffset.y + layoutMeasurement.height <
      contentSize.height - LOAD_MORE_MARGIN
    )
      return;
    if (paging.current || loading || error || page >= totalPages) return;
    paging.current = true;
    setPage((x) => x + 1);
  };
  const notReady =
    error?.code === "RESOURCE_NOT_FOUND" || error?.code === "DATA_NOT_READY";
  const title = complexId
    ? (name ?? "이 단지 경매")
    : meta || items.length
      ? `경매 물건 · 지도 화면 안 ${(meta?.total ?? items.length).toLocaleString("ko-KR")}건`
      : "경매 물건 · 지도 화면 안";
  const sourceLine = auctionSourceLine(meta, repo.mode);
  const filtered =
    source != null || includeClosed || (serverSort && excludeShare);
  return (
    <View style={s.screen}>
      <Header title={title} onBack={onBack} />
      <View style={{ paddingVertical: 10, gap: 8 }}>
        {serverSort && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
          >
            {SORTS.filter(
              ([k]) => k !== "recent_trade_discount" || hasTrade,
            ).map(([k, n]) => (
              <Chip
                key={k}
                selected={sort === k}
                onPress={() => change(() => setSort(k))}
              >
                {n}
              </Chip>
            ))}
          </ScrollView>
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
        >
          {!complexId &&
            GROUPS.map(([k, n]) => (
              <Chip
                key={k}
                selected={group === k}
                onPress={() => change(() => setGroup(k))}
              >
                {n}
              </Chip>
            ))}
          <Chip selected={filtered} onPress={() => setFilterOpen(true)}>
            ⚙ 필터
          </Chip>
        </ScrollView>
      </View>
      <ScrollView
        testID="auction-list"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
        onScroll={loadMore}
        scrollEventThrottle={100}
      >
        {items.map((a) => (
          <AuctionRow
            key={a.id}
            a={a}
            unit={unit}
            onPress={() => onAuction(a)}
          />
        ))}
        {loading ? (
          <StateCard loading />
        ) : error ? (
          notReady ? (
            <StateCard error={NOT_READY} />
          ) : (
            <StateCard
              error={error.message}
              onRetry={() => setRetry((x) => x + 1)}
            />
          )
        ) : items.length === 0 ? (
          <StateCard
            empty={
              complexId
                ? "이 단지에 진행 중인 경매가 없어요"
                : "이 화면 안에 진행 중인 경매가 없어요"
            }
          />
        ) : page >= totalPages ? (
          <T
            size={14}
            color={C.light}
            style={{ textAlign: "center", padding: 18 }}
          >
            경매 {(meta?.total ?? items.length).toLocaleString("ko-KR")}건을
            모두 확인했어요
          </T>
        ) : null}
      </ScrollView>
      <View
        style={{ padding: 16, gap: 10, borderTopWidth: 1, borderColor: C.rule }}
      >
        {sourceLine !== "" && (
          <T size={13} color={C.muted} style={{ textAlign: "center" }}>
            {sourceLine}
          </T>
        )}
        <Btn secondary icon="map" onPress={onBack}>
          지도로 보기
        </Btn>
      </View>
      {filterOpen && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            justifyContent: "flex-end",
            backgroundColor: "rgba(17,17,16,.32)",
            zIndex: 10,
          }}
        >
          <Pressable
            accessibilityLabel="필터 닫기"
            onPress={() => setFilterOpen(false)}
            style={{ position: "absolute", inset: 0 }}
          />
          <View
            style={{
              backgroundColor: C.bg,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: 18,
              gap: 4,
            }}
          >
            <Section title="경매 종류">
              <View style={[s.row, { flexWrap: "wrap", gap: 6 }]}>
                {SOURCES.map(([k, n]) => (
                  <Chip
                    key={n}
                    selected={source === k}
                    onPress={() => change(() => setSource(k))}
                  >
                    {n}
                  </Chip>
                ))}
              </View>
            </Section>
            {serverSort && (
              <View style={s.between}>
                <T size={15}>지분 물건 빼기</T>
                <Switch
                  accessibilityLabel="지분 물건 빼기"
                  value={excludeShare}
                  onValueChange={(v) => change(() => setExcludeShare(v))}
                  trackColor={{ true: C.primary }}
                />
              </View>
            )}
            <View style={[s.between, { paddingVertical: 8 }]}>
              <T size={15}>끝난 경매도 보기</T>
              <Switch
                accessibilityLabel="끝난 경매도 보기"
                value={includeClosed}
                onValueChange={(v) => change(() => setIncludeClosed(v))}
                trackColor={{ true: C.primary }}
              />
            </View>
            <Btn onPress={() => setFilterOpen(false)} style={{ marginTop: 8 }}>
              완료
            </Btn>
          </View>
        </View>
      )}
    </View>
  );
}
