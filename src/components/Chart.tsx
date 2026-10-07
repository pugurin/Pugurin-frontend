import React from "react";
import { View } from "react-native";
import Svg, { Path, Line, Rect } from "react-native-svg";
import type { Trend } from "../api/types";
import { C } from "../theme/tokens";
import { T, s } from "./ui";
export function Chart({
  trend,
  bar = false,
  comparison = false,
}: {
  trend: Trend[];
  bar?: boolean;
  comparison?: boolean;
}) {
  const items = bar ? trend.slice(-12) : trend;
  const values = items.flatMap((v) =>
    v.median_price_per_pyeong == null ? [] : [v.median_price_per_pyeong],
  );
  if (!values.length) return <T color={C.muted}>표시할 통계가 없어요</T>;
  const min = Math.min(...values) * 0.93,
    max = Math.max(...values) * 1.04;
  const x = (i: number) => 12 + (i * 296) / Math.max(1, items.length - 1);
  const y = (v: number) => 118 - ((v - min) / (max - min)) * 95;
  let path = "";
  let pen = false;
  items.forEach((v, i) => {
    if (v.median_price_per_pyeong == null) {
      pen = false;
      return;
    }
    path += `${pen ? "L" : "M"}${x(i)},${y(v.median_price_per_pyeong)} `;
    pen = true;
  });
  return (
    <View style={{ gap: 8 }}>
      <Svg
        viewBox="0 0 320 140"
        width="100%"
        height={140}
        accessibilityLabel="월별 평당가 중위값 추이"
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
            (v, i) =>
              v.median_price_per_pyeong != null && (
                <Rect
                  key={i}
                  x={12 + i * 25}
                  y={y(v.median_price_per_pyeong)}
                  width={16}
                  height={125 - y(v.median_price_per_pyeong)}
                  rx={2}
                  fill={C.ink}
                />
              ),
          )
        ) : (
          <>
            <Path d={path} stroke={C.ink} strokeWidth={2.5} fill="none" />
            {comparison && (
              <Path
                d="M12 105 L42 108 L62 96 L100 101 L132 90 L172 94 L204 80 L244 84 L275 77 L308 71"
                stroke={C.light}
                strokeWidth={2}
                strokeDasharray="5 4"
                fill="none"
              />
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
      {!bar && (
        <T size={12} color={C.muted}>
          중위값 · 전용 기준 · 거래 3건 미만인 달은 비움
        </T>
      )}
      {comparison && (
        <T size={12} color={C.muted}>
          ━ 이 단지　┅ 우동 전체 (샘플 비교)
        </T>
      )}
    </View>
  );
}
