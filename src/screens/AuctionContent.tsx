import React, { useEffect, useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";
import type { Repository } from "../api/repository";
import type { AuctionDetail, AuctionResult, Meta } from "../api/types";
import type { SheetStage } from "../components/Sheet";
import { Btn, Section, StateCard, T, s } from "../components/ui";
import {
  auctionTitle,
  compareLine,
  dday,
  formatWon,
  ratioLine,
} from "../state/auction";
import { C } from "../theme/tokens";

const KST_OFFSET_MS = 9 * 3600000;
// 노란 칩(지분 물건). 디자인 토큰에 노랑이 없어 여기서만 쓴다
const SHARE_WASH = "#FFF3C4";
const SHARE_INK = "#7A5A00";

// 날짜 문자열을 한국 시간 "YYYY-MM-DD"와 "HH:mm"으로 쪼갠다. 날짜만 오면 시각은 null
function kstParts(
  v: string | null,
): { date: string; time: string | null } | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return { date: v, time: null };
  const t = Date.parse(v);
  if (Number.isNaN(t)) return null;
  const iso = new Date(t + KST_OFFSET_MS).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}
const dotted = (d: string) => d.replaceAll("-", ".");
function formatDate(v: string | null): string {
  const p = kstParts(v);
  return p ? dotted(p.date) : "—";
}
function formatDateTime(v: string | null): string {
  const p = kstParts(v);
  return p ? `${dotted(p.date)}${p.time ? ` ${p.time}` : ""}` : "—";
}

// 건물면적이 있으면 건물, 없으면 토지. 단위는 평/㎡ 토글을 따른다
function areaOf(a: AuctionDetail, unit: "평" | "㎡"): string | null {
  const [m2, py] =
    a.building_area_m2 != null || a.building_area_pyeong != null
      ? [a.building_area_m2, a.building_area_pyeong]
      : [a.land_area_m2, a.land_area_pyeong];
  const v = unit === "평" ? py : m2;
  return v == null ? null : `${v}${unit}`;
}

function Badge({
  children,
  bg = C.bg2,
  ink = C.ink2,
}: {
  children: React.ReactNode;
  bg?: string;
  ink?: string;
}) {
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <T size={13} bold color={ink}>
        {children}
      </T>
    </View>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[s.between, { alignItems: "flex-start" }]}>
      <T size={14} color={C.muted}>
        {label}
      </T>
      <View style={{ flex: 1, alignItems: "flex-end" }}>{children}</View>
    </View>
  );
}

// 가격 비교 막대. 가장 큰 값을 100%로 둔다
function PriceBars({ a }: { a: AuctionDetail }) {
  const rows = [
    { label: "감정가", value: a.appraisal_price, color: C.disabled },
    {
      label: "최근 실거래",
      value:
        a.recent_trade_price != null && a.recent_trade_price > 0
          ? a.recent_trade_price
          : null,
      color: C.apartment,
    },
    { label: "최저가", value: a.min_price, color: C.brown },
  ].filter(
    (r): r is { label: string; value: number; color: string } =>
      r.value != null,
  );
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <Section title="가격 비교">
      {rows.map((r) => (
        <View key={r.label} style={{ gap: 4 }}>
          <View style={s.between}>
            <T size={14} color={C.muted}>
              {r.label}
            </T>
            <T size={14} bold>
              {formatWon(r.value)}
            </T>
          </View>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: C.bg2 }}>
            <View
              style={{
                height: 10,
                borderRadius: 5,
                backgroundColor: r.color,
                width: `${Math.max(2, Math.round((r.value / max) * 100))}%`,
              }}
            />
          </View>
        </View>
      ))}
    </Section>
  );
}

function resultNote(r: AuctionResult | undefined): string | null {
  if (!r) return null;
  const parts = [
    r.bidders != null && `입찰 ${r.bidders}명`,
    r.top_price != null && `최고가 ${formatWon(r.top_price)}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function History({ a, todayKst }: { a: AuctionDetail; todayKst: string }) {
  if (!a.schedule.length) return null;
  // 날짜가 없는 줄은 맨 뒤로 보낸다
  const rows = [...a.schedule].sort((x, y) =>
    (kstParts(x.date)?.date ?? "9999").localeCompare(
      kstParts(y.date)?.date ?? "9999",
    ),
  );
  return (
    <Section title="진행 이력">
      {rows.map((r, i) => {
        const d = kstParts(r.date)?.date;
        const upcoming =
          !a.is_closed &&
          d != null &&
          d >= todayKst &&
          (r.result == null || r.result === "예정");
        const note = resultNote(
          d ? a.results.find((x) => kstParts(x.date)?.date === d) : undefined,
        );
        return (
          <View
            key={`${r.date}-${i}`}
            style={{ flexDirection: "row", gap: 10 }}
          >
            <View
              accessibilityLabel={upcoming ? "다가오는 기일" : undefined}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginTop: 7,
                backgroundColor: upcoming ? C.brown : C.disabled,
              }}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={s.between}>
                <View style={s.row}>
                  <T size={14} bold={upcoming}>
                    {formatDate(r.date)}
                  </T>
                  <T size={14} color={C.muted}>
                    {r.kind ?? "기일"}
                  </T>
                </View>
                <T
                  size={14}
                  bold={upcoming}
                  color={upcoming ? C.brownInk : C.muted}
                >
                  {r.result ?? "—"}
                </T>
              </View>
              {r.min_price != null && (
                <T size={13} color={C.muted}>
                  최저가 {formatWon(r.min_price)}
                  {r.sale_price != null
                    ? ` · 매각가 ${formatWon(r.sale_price)}`
                    : ""}
                </T>
              )}
              {note && (
                <T size={13} color={C.muted}>
                  {note}
                </T>
              )}
            </View>
          </View>
        );
      })}
    </Section>
  );
}

// 경매 시트 내용. 단지 시트(ComplexContent)처럼 peek는 요약만, half·full은 상세까지 보여준다
export function AuctionContent({
  id,
  repo,
  stage,
  onStage,
  unit,
  notify,
}: {
  id: string;
  repo: Repository;
  stage: SheetStage;
  onStage: (s: SheetStage) => void;
  unit: "평" | "㎡";
  notify: (m: string) => void;
}) {
  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [meta, setMeta] = useState<Meta>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const a = new AbortController();
    setLoading(true);
    setError(null);
    repo
      .auction(id, a.signal)
      .then((r) => {
        if (a.signal.aborted) return;
        setAuction(r.data);
        setMeta(r.meta);
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!a.signal.aborted) setLoading(false);
      });
    return () => a.abort();
  }, [id, repo, retry]);
  if (!auction || auction.id !== id || error)
    return (
      <StateCard
        loading={loading}
        error={error}
        onRetry={() => setRetry((x) => x + 1)}
      />
    );
  const a = auction;
  const today = new Date();
  const todayKst = kstParts(today.toISOString())!.date;
  const d = dday(a, today);
  const compare = compareLine(a);
  const area = areaOf(a, unit);
  const sub = [a.usage, area].filter(Boolean).join(" · ");
  const priceLine = [
    ratioLine(a),
    a.fail_count != null ? `유찰 ${a.fail_count}회` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const canCopy =
    Platform.OS === "web" &&
    typeof navigator !== "undefined" &&
    !!navigator.clipboard?.writeText;
  const copyCaseNo = () =>
    navigator.clipboard.writeText(a.case_no).then(
      () => notify("사건번호를 복사했어요"),
      () => notify("사건번호를 복사하지 못했어요"),
    );
  const openSource = () => {
    if (meta?.source_url)
      void Linking.openURL(meta.source_url).catch(() =>
        notify("원문을 열 수 없어요"),
      );
  };
  const asOf = meta?.data_as_of?.slice(0, 10).replaceAll("-", ".");
  const sourceLine = [
    (meta?.data_mode ?? repo.mode) === "sample" && "샘플 데이터",
    meta?.source_attribution && `출처: ${meta.source_attribution}`,
    asOf && `기준일 ${asOf}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        <Badge>{a.source === "public" ? "공매" : "법원경매"}</Badge>
        {a.is_closed && <Badge>끝난 경매</Badge>}
        {d && (
          <Badge
            bg={d.soon ? C.brownWash : C.bg2}
            ink={d.soon ? C.brownInk : C.ink2}
          >
            입찰 {d.label}
          </Badge>
        )}
        {a.is_share && (
          <Badge bg={SHARE_WASH} ink={SHARE_INK}>
            지분
          </Badge>
        )}
      </View>
      <T size={stage === "full" ? 24 : 21} bold style={{ marginTop: 8 }}>
        {auctionTitle(a)}
      </T>
      {sub !== "" && (
        <T size={14} color={C.muted}>
          {sub}
        </T>
      )}
      {!a.location_precise && (
        <T size={13} color={C.light}>
          지도 위치는 대략적이에요
        </T>
      )}
      <T size={28} bold style={{ marginTop: 12 }}>
        {a.min_price == null
          ? "최저가 미정"
          : `최저가 ${formatWon(a.min_price)}`}
      </T>
      {compare && (
        <T
          size={14}
          bold={compare.good}
          color={compare.good ? C.greenInk : C.muted}
        >
          {compare.text}
        </T>
      )}
      {priceLine !== "" && (
        <T size={14} color={C.muted}>
          {priceLine}
        </T>
      )}
      {stage === "peek" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onStage("half")}
          style={{ paddingVertical: 12 }}
        >
          <T size={14} color={C.light}>
            위로 올리면 경매 정보를 더 볼 수 있어요 ⌃
          </T>
        </Pressable>
      ) : (
        <>
          <PriceBars a={a} />
          <History a={a} todayKst={todayKst} />
          <Section title="물건 정보">
            <InfoRow label="사건번호">
              <T size={14} selectable>
                {a.case_no}
              </T>
            </InfoRow>
            {a.court_name && (
              <InfoRow label="법원">
                <T size={14}>{a.court_name}</T>
              </InfoRow>
            )}
            {a.deposit != null && (
              <InfoRow label="입찰보증금">
                <T size={14}>{formatWon(a.deposit)}</T>
              </InfoRow>
            )}
            {area && (
              <InfoRow
                label={
                  a.building_area_m2 != null || a.building_area_pyeong != null
                    ? "건물면적"
                    : "토지면적"
                }
              >
                <T size={14}>{area}</T>
              </InfoRow>
            )}
            {a.status && (
              <InfoRow label="진행 상태">
                <T size={14}>{a.status}</T>
              </InfoRow>
            )}
            {a.source === "public" && (a.bid_start_at || a.bid_end_at) && (
              <InfoRow label="입찰 기간">
                <T size={14}>
                  {formatDateTime(a.bid_start_at)} ~{" "}
                  {formatDateTime(a.bid_end_at)}
                </T>
              </InfoRow>
            )}
          </Section>
          <View
            style={[
              s.card,
              { backgroundColor: C.brownWash, borderColor: C.brown },
            ]}
          >
            <T size={14} color={C.brownInk}>
              임차인·선순위 권리 같은 권리관계는 퍼구린이 확인하지 않아요. 입찰
              전에 법원 문서를 꼭 확인하세요.
            </T>
          </View>
          {meta?.source_url && (
            <View style={{ gap: 8, paddingVertical: 12 }}>
              <View style={s.row}>
                <Btn style={{ flex: 1 }} onPress={openSource}>
                  법원경매정보 열기 ↗
                </Btn>
                {canCopy && (
                  <Btn secondary onPress={copyCaseNo}>
                    사건번호 복사
                  </Btn>
                )}
              </View>
              <T size={13} color={C.muted}>
                사건번호로 검색하면 원문을 볼 수 있어요
              </T>
            </View>
          )}
          {sourceLine !== "" && (
            <T size={13} color={C.muted}>
              {sourceLine}
            </T>
          )}
        </>
      )}
    </>
  );
}
