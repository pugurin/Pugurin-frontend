import React from "react";
import { View } from "react-native";
import Svg, { Path, Line, Rect, Circle } from "react-native-svg";
import type { Trend, Metrics } from "../api/types";
import { C } from "../theme/tokens";
import { T, s } from "./ui";
export function Chart({
  trend,
  bar = false,
  comparison,
  metric = "median_price_per_pyeong",
}: {
  trend: Trend[];
  bar?: boolean;
  comparison?: Trend[];
  metric?: keyof Metrics;
}) {
  const items = bar ? trend.slice(-12) : trend;
  const compared = items.map((p) =>
    comparison?.find((c) => c.month === p.month),
  );
  const values = [...items, ...compared].flatMap((p) =>
    p?.[metric] == null ? [] : [p[metric]!],
  );
  if (!values.length) return <T color={C.muted}>표시할 통계가 없어요</T>;
  const min = Math.min(...values) * 0.93,
    max = Math.max(...values) * 1.04;
  const x = (i: number) => 12 + (i * 296) / Math.max(1, items.length - 1);
  const y = (v: number) => 118 - ((v - min) / Math.max(1, max - min)) * 95;
  const path = (points: (Trend | undefined)[]) => {
    let d = "",
      pen = false;
    points.forEach((p, i) => {
      const v = p?.[metric];
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i)},${y(v)} `;
      pen = true;
    });
    return d;
  };
  const label =
    metric === "median_monthly_rent"
      ? "월세"
      : metric === "median_deposit_per_pyeong"
        ? "평당 보증금"
        : "평당가";
  return (
    <View style={{ gap: 8 }}>
      <Svg
        viewBox="0 0 320 140"
        width="100%"
        height={140}
        accessibilityLabel={`월별 ${label} 중위값 추이`}
      >
        {[25, 65, 105, 125].map((i) => (
          <Line
            key={i}
            x1={8}
            x2={312}
            y1={i}
            y2={i}
            stroke={C.rule}
            strokeWidth={1}
          />
        ))}
        {bar ? (
          items.map(
            (p, i) =>
              p[metric] != null && (
                <Rect
                  key={p.month}
                  x={12 + (i * 296) / Math.max(1, items.length)}
                  y={y(p[metric]!)}
                  width={Math.min(16, 240 / Math.max(1, items.length))}
                  height={125 - y(p[metric]!)}
                  rx={2}
                  fill={C.ink}
                />
              ),
          )
        ) : (
          <>
            <Path
              d={path(items)}
              stroke={C.ink}
              strokeWidth={2.5}
              fill="none"
            />
            {items.map(
              (p, i) =>
                p[metric] != null && (
                  <Circle
                    key={p.month}
                    cx={x(i)}
                    cy={y(p[metric]!)}
                    r={2.5}
                    fill={C.ink}
                  />
                ),
            )}
            {comparison && (
              <>
                {compared.map(
                  (p, i) =>
                    p?.[metric] != null && (
                      <Circle
                        key={p.month}
                        cx={x(i)}
                        cy={y(p[metric]!)}
                        r={2}
                        fill={C.light}
                      />
                    ),
                )}
                <Path
                  d={path(compared)}
                  stroke={C.light}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  fill="none"
                />
              </>
            )}
          </>
        )}
      </Svg>
      <View style={s.between}>
        <T size={12} color={C.light}>
          {items[0]?.month.replace("-", ".")}
        </T>
        <T size={12} color={C.light}>
          {items.at(-1)?.month.replace("-", ".")}
        </T>
      </View>
      <T size={12} color={C.muted}>
        {label} 중위값 ·{" "}
        {metric === "median_monthly_rent" ? "월 금액" : "전용 기준"} · 거래 3건
        미만인 달은 비움
      </T>
      {comparison && (
        <T size={12} color={C.muted}>
          ━ 이 단지　┅ 해당 지역 전체
        </T>
      )}
    </View>
  );
}
