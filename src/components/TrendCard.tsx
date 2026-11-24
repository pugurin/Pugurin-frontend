import React, { useId, useState } from "react";
import { Pressable, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text,
} from "react-native-svg";
import type { Metrics, Trend } from "../api/types";
import { C } from "../theme/tokens";
import { T, s } from "./ui";
import { formatPrice } from "../state/market";

// 환율 카드처럼: 현재값을 크게, 기간 대비 등락, 부드러운 선 + 그라데이션 영역,
// 누르거나 끌면 그 달의 값을 보여 준다.

// 축: x = 시간(거래 월), y = 가격
const TOP = 26; // 축 제목·최고 라벨 자리
const PLOT_BOTTOM = 176; // x축 위치
const H = PLOT_BOTTOM + 40; // x축 눈금·축 제목 자리
const LEFT = 50; // y축 눈금 금액 자리
const RIGHT = 12;

// 보기 좋은 눈금(1·2·2.5·5 × 10^n 간격)
export function niceTicks(lo: number, hi: number, count = 4) {
  const raw = (hi - lo) / count || Math.abs(hi) || 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw)!;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + step * 0.5; v += step) ticks.push(v);
  if (ticks.at(-1)! < hi) ticks.push(ticks.at(-1)! + step);
  return ticks;
}
// x축 눈금: 처음·끝을 포함해 4~5개
export function monthTicks(n: number) {
  if (n <= 1) return [0];
  const step = Math.max(1, Math.ceil((n - 1) / 4));
  const out: number[] = [];
  for (let i = 0; i < n - 1; i += step) out.push(i);
  if (n - 1 - out.at(-1)! < step / 2) out.pop();
  out.push(n - 1);
  return out;
}
const shortMonth = (m?: string) =>
  m ? `${m.slice(2, 4)}.${m.slice(5, 7)}` : "";

export const RANGES = [
  { months: 6, label: "6개월", ago: "6개월 전" },
  { months: 12, label: "1년", ago: "1년 전" },
  { months: 36, label: "3년", ago: "3년 전" },
] as const;

type Pt = { x: number; y: number };

// 단조 3차 보간(Fritsch–Carlson): 값이 없는 구간 위로 튀어 오르지 않는 부드러운 선
export function smoothPath(pts: Pt[]) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  const n = pts.length;
  const dx = pts.slice(1).map((p, i) => p.x - pts[i].x);
  const m = pts.slice(1).map((p, i) => (p.y - pts[i].y) / dx[i]);
  const t = pts.map((_, i) => {
    if (i === 0) return m[0];
    if (i === n - 1) return m[n - 2];
    return m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i],
      b = t[i + 1] / m[i],
      h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const c = dx[i] / 3;
    d += ` C${pts[i].x + c},${pts[i].y + c * t[i]} ${pts[i + 1].x - c},${
      pts[i + 1].y - c * t[i + 1]
    } ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

// 거래가 적어 비어 있는 달은 건너뛰고 이어 그린다(환율 그래프처럼 한 줄)
const connected = (
  vs: (number | null)[],
  x: (i: number) => number,
  y: (v: number) => number,
) => vs.flatMap((v, i) => (v == null ? [] : [{ x: x(i), y: y(v) }]));

const month = (m?: string) => m?.replace("-", ".") ?? "";

export function TrendCard({
  trend,
  comparison,
  metric = "median_price_per_pyeong",
}: {
  trend: Trend[];
  comparison?: Trend[];
  metric?: keyof Metrics;
}) {
  const ranges = RANGES.filter(
    (r, i) => i === 0 || r.months <= Math.max(trend.length, 6),
  );
  const [range, setRange] = useState<number>(ranges.at(-1)!.months);
  const [active, setActive] = useState<number | null>(null);
  const [width, setWidth] = useState(320);
  const gid = `trend${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const label =
    metric === "median_monthly_rent"
      ? "월세"
      : metric === "median_deposit_per_pyeong"
        ? "평당 보증금"
        : "평당가";
  const items = trend.slice(-range);
  const vals = items.map((p) => p[metric] ?? null);
  const cmp = items.map(
    (p) => comparison?.find((c) => c.month === p.month)?.[metric] ?? null,
  );
  const valid = vals.flatMap((v, i) => (v == null ? [] : [{ v, i }]));
  if (!valid.length)
    return <T color={C.muted}>이 기간에는 표시할 통계가 없어요</T>;

  const first = valid[0],
    last = valid.at(-1)!;
  const shown =
    active != null && vals[active] != null
      ? { v: vals[active]!, i: active }
      : last;
  const diff = shown.v - first.v;
  const pct = first.v ? (diff / first.v) * 100 : 0;
  const tone = diff > 0 ? C.rise : diff < 0 ? C.fall : C.muted;
  const lineColor = last.v - first.v < 0 ? C.fall : C.rise;
  const rangeInfo = RANGES.find((r) => r.months === range)!;

  const all = [...vals, ...cmp].filter((v): v is number => v != null);
  const lo = Math.min(...all),
    hi = Math.max(...all);
  const span = hi - lo || Math.max(1, hi * 0.1);
  const yTicks = niceTicks(Math.max(0, lo - span * 0.3), hi + span * 0.1);
  const min = yTicks[0],
    max = yTicks.at(-1)!;
  const plotW = Math.max(1, width - LEFT - RIGHT);
  const x = (i: number) => LEFT + (i * plotW) / Math.max(1, items.length - 1);
  const y = (v: number) =>
    TOP + (1 - (v - min) / (max - min || 1)) * (PLOT_BOTTOM - TOP);
  const xTicks = monthTicks(items.length);

  const lineSegs = [connected(vals, x, y)];
  const cmpSegs = [connected(cmp, x, y)].filter((g) => g.length);
  const top = valid.reduce((a, b) => (b.v > a.v ? b : a));
  const bottom = valid.reduce((a, b) => (b.v < a.v ? b : a));
  const anchor = (px: number) =>
    px < LEFT + 40 ? "start" : px > width - 50 ? "end" : "middle";

  const pick = (lx: number) => {
    const i = Math.round(((lx - LEFT) / plotW) * (items.length - 1));
    const c = Math.min(items.length - 1, Math.max(0, i));
    // 값이 없는 달이면 가장 가까운 값 있는 달로
    const near = valid.reduce((a, b) =>
      Math.abs(b.i - c) < Math.abs(a.i - c) ? b : a,
    );
    setActive(near.i);
  };

  return (
    <View style={{ gap: 10 }}>
      {/* 머리: 현재값과 등락 */}
      <View style={{ gap: 2 }}>
        <T size={13} color={C.muted}>
          {active != null
            ? `${month(items[shown.i].month)} ${label} 중위값`
            : `${label} 중위값 · ${month(items[last.i].month)} 기준`}
        </T>
        <T bold size={30} style={{ letterSpacing: -0.5 }}>
          {formatPrice(shown.v)}원
        </T>
        <View style={[s.row, { gap: 6 }]}>
          <T size={14} bold color={tone}>
            {diff > 0 ? "▲" : diff < 0 ? "▼" : "-"}{" "}
            {diff === 0 ? "변동 없음" : `${formatPrice(Math.abs(diff))}원`}
            {diff !== 0 && ` (${diff > 0 ? "+" : ""}${pct.toFixed(1)}%)`}
          </T>
          <T size={13} color={C.light}>
            {first.i === 0 ? rangeInfo.ago : month(items[first.i].month)} 대비
          </T>
        </View>
      </View>

      {cmpSegs.length > 0 && (
        <View style={[s.row, { gap: 14 }]}>
          <View style={[s.row, { gap: 6 }]}>
            <View
              style={{
                width: 14,
                height: 3,
                borderRadius: 2,
                backgroundColor: lineColor,
              }}
            />
            <T size={12}>이 단지</T>
          </View>
          <View style={[s.row, { gap: 6 }]}>
            <Svg width={14} height={4}>
              <Line
                x1={0}
                x2={14}
                y1={2}
                y2={2}
                stroke={C.light}
                strokeWidth={2}
                strokeDasharray="3 3"
              />
            </Svg>
            <T size={12} color={C.muted}>
              해당 지역 전체
            </T>
          </View>
        </View>
      )}

      {/* 그래프: 누르거나 끌면 그 달 값 */}
      <View
        onLayout={(e) => setWidth(Math.max(120, e.nativeEvent.layout.width))}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => true}
        onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}
        onResponderRelease={() => setActive(null)}
        onResponderTerminate={() => setActive(null)}
        style={{ cursor: "crosshair" } as any}
      >
        <Svg
          width={width}
          height={H}
          accessibilityLabel={`월별 ${label} 중위값 추이, ${formatPrice(
            first.v,
          )}원에서 ${formatPrice(last.v)}원`}
        >
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={lineColor} stopOpacity={0.22} />
              <Stop offset="1" stopColor={lineColor} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {/* y축: 가격 눈금과 가로 눈금선 */}
          {yTicks.map((v) => (
            <React.Fragment key={`y${v}`}>
              <Line
                x1={LEFT}
                x2={width - RIGHT}
                y1={y(v)}
                y2={y(v)}
                stroke={C.bg2}
                strokeWidth={1}
              />
              <Text
                x={LEFT - 6}
                y={y(v) + 3.5}
                fontSize={10}
                fill={C.light}
                textAnchor="end"
              >
                {formatPrice(v)}
              </Text>
            </React.Fragment>
          ))}
          <Text
            x={LEFT - 6}
            y={11}
            fontSize={10}
            fill={C.muted}
            textAnchor="end"
          >
            가격(원)
          </Text>
          <Line
            x1={LEFT}
            x2={LEFT}
            y1={TOP - 6}
            y2={PLOT_BOTTOM}
            stroke={C.rule}
            strokeWidth={1}
          />
          {/* x축: 시간(거래 월) 눈금 */}
          <Line
            x1={LEFT}
            x2={width - RIGHT}
            y1={PLOT_BOTTOM}
            y2={PLOT_BOTTOM}
            stroke={C.rule}
            strokeWidth={1}
          />
          {xTicks.map((i) => (
            <React.Fragment key={`x${i}`}>
              <Line
                x1={x(i)}
                x2={x(i)}
                y1={PLOT_BOTTOM}
                y2={PLOT_BOTTOM + 4}
                stroke={C.rule}
                strokeWidth={1}
              />
              <Text
                x={x(i)}
                y={PLOT_BOTTOM + 16}
                fontSize={10}
                fill={C.light}
                textAnchor={
                  i === 0 ? "start" : i === items.length - 1 ? "end" : "middle"
                }
              >
                {shortMonth(items[i].month)}
              </Text>
            </React.Fragment>
          ))}
          <Text
            x={LEFT + plotW / 2}
            y={PLOT_BOTTOM + 34}
            fontSize={10}
            fill={C.muted}
            textAnchor="middle"
          >
            시간(거래 월) →
          </Text>
          {lineSegs.map((seg, k) =>
            seg.length > 1 ? (
              <Path
                key={`a${k}`}
                d={`${smoothPath(seg)} L${seg.at(-1)!.x},${PLOT_BOTTOM} L${seg[0].x},${PLOT_BOTTOM} Z`}
                fill={`url(#${gid})`}
                stroke="none"
              />
            ) : null,
          )}
          {cmpSegs.map((seg, k) =>
            seg.length > 1 ? (
              <Path
                key={`c${k}`}
                d={smoothPath(seg)}
                stroke={C.light}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                fill="none"
              />
            ) : (
              <Circle
                key={`c${k}`}
                cx={seg[0].x}
                cy={seg[0].y}
                r={1.5}
                fill={C.light}
              />
            ),
          )}
          {lineSegs.map((seg, k) =>
            seg.length > 1 ? (
              <Path
                key={`l${k}`}
                d={smoothPath(seg)}
                stroke={lineColor}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ) : (
              <Circle
                key={`l${k}`}
                cx={seg[0].x}
                cy={seg[0].y}
                r={2.5}
                fill={lineColor}
              />
            ),
          )}
          {valid.length > 1 && top.v !== bottom.v && active == null && (
            <>
              <Text
                x={x(top.i)}
                y={y(top.v) - 8}
                fontSize={11}
                fill={C.rise}
                textAnchor={anchor(x(top.i))}
              >
                {`최고 ${formatPrice(top.v)}`}
              </Text>
              <Text
                x={x(bottom.i)}
                y={y(bottom.v) + 16}
                fontSize={11}
                fill={C.fall}
                textAnchor={anchor(x(bottom.i))}
              >
                {`최저 ${formatPrice(bottom.v)}`}
              </Text>
            </>
          )}
          {active != null ? (
            <>
              <Line
                x1={x(shown.i)}
                x2={x(shown.i)}
                y1={TOP - 6}
                y2={PLOT_BOTTOM}
                stroke={C.muted}
                strokeWidth={1}
              />
              <Circle
                cx={x(shown.i)}
                cy={y(shown.v)}
                r={5}
                fill={C.surface}
                stroke={lineColor}
                strokeWidth={2.5}
              />
            </>
          ) : (
            <>
              <Circle
                cx={x(last.i)}
                cy={y(last.v)}
                r={8}
                fill={lineColor}
                opacity={0.18}
              />
              <Circle cx={x(last.i)} cy={y(last.v)} r={4} fill={lineColor} />
            </>
          )}
        </Svg>
      </View>

      {/* 기간 선택 */}
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          backgroundColor: C.bg2,
          borderRadius: 10,
          padding: 3,
        }}
      >
        {ranges.map((r) => {
          const on = r.months === range;
          return (
            <Pressable
              key={r.months}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              aria-selected={on}
              onPress={() => {
                setRange(r.months);
                setActive(null);
              }}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 7,
                borderRadius: 8,
                backgroundColor: on ? C.surface : "transparent",
                boxShadow: on ? "0 1px 3px rgba(0,0,0,0.08)" : undefined,
              }}
            >
              <T size={14} bold={on} color={on ? C.ink : C.muted}>
                {r.label}
              </T>
            </Pressable>
          );
        })}
      </View>
      <T size={12} color={C.light}>
        {metric === "median_monthly_rent" ? "월 금액" : "전용 기준"} · 거래 3건
        미만인 달은 건너뜀 · 그래프를 누르면 그 달 값을 볼 수 있어요
      </T>
    </View>
  );
}
