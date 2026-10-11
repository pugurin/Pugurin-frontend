import React from "react";
import { Pressable, View } from "react-native";
import type { Transaction } from "../api/types";
import { formatArea, priceLabel } from "../state/market";
import { C } from "../theme/tokens";
import { T, s } from "./ui";
export function TransactionRow({
  tx,
  name,
  onPress,
  unit = "평",
}: {
  tx: Transaction;
  name?: string;
  onPress?: () => void;
  unit?: "평" | "㎡";
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={{
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderColor: C.rule,
        gap: 5,
      }}
    >
      {name && (
        <T bold size={17}>
          {name}
        </T>
      )}
      <View style={s.between}>
        <T
          bold
          size={21}
          color={tx.is_cancelled ? C.light : C.ink}
          style={
            tx.is_cancelled ? { textDecorationLine: "line-through" } : undefined
          }
        >
          {priceLabel(tx)}
        </T>
        <T size={14} color={C.muted}>
          {tx.contract_date.replaceAll("-", ".")}
        </T>
      </View>
      <View style={s.between}>
        <T size={15} color={C.muted}>
          {formatArea(tx, unit)}
          {tx.floor != null ? ` · ${tx.floor}층` : ""}
        </T>
        <View style={s.row}>
          {/* 전월세 거래는 거래방식(중개/직거래)이 공공데이터에 없어 null로 온다 → 배지를 숨긴다 */}
          {tx.trade_method != null && (
            <T size={12} color={tx.trade_method === "direct" ? C.brown : C.muted}>
              {tx.trade_method === "direct" ? "직거래" : "중개"}
            </T>
          )}
          {tx.is_cancelled && (
            <View
              style={{
                paddingHorizontal: 7,
                paddingVertical: 2,
                backgroundColor: C.bg2,
                borderRadius: 4,
              }}
            >
              <T size={12} color={C.brown}>
                해제
              </T>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
