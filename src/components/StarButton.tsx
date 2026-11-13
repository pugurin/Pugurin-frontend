import React, { useContext } from "react";
import { Pressable } from "react-native";
import type { ComplexInput, RegionInput } from "../api/interests";
import { InterestsContext } from "../state/interests";
import { C } from "../theme/tokens";
import { Icon } from "./ui";

// 단지·지역 시트 제목 옆 관심 등록 ☆. 담겨 있으면 채운 별
export function StarButton(
  props: { kind: "complex"; item: ComplexInput } | { kind: "region"; item: RegionInput },
) {
  const v = useContext(InterestsContext);
  const on =
    props.kind === "complex" ? v.hasComplex(props.item.complex_id) : v.hasRegion(props.item.region_code);
  const key = props.kind === "complex" ? `complex:${props.item.complex_id}` : `region:${props.item.region_code}`;
  const what = props.kind === "complex" ? "단지" : "지역";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`관심 ${what} ${on ? "해제" : "등록"}`}
      accessibilityState={{ selected: on, disabled: v.busy.includes(key) }}
      aria-pressed={on}
      disabled={v.busy.includes(key)}
      onPress={() =>
        props.kind === "complex" ? v.toggleComplex(props.item) : v.toggleRegion(props.item)
      }
      style={({ pressed }) => ({
        padding: 12,
        borderWidth: 1,
        borderColor: on ? C.greenRule : C.rule,
        backgroundColor: on ? C.greenWash : pressed ? C.bg2 : C.surface,
        borderRadius: 12,
      })}
    >
      <Icon name="star" color={on ? C.primary : C.muted} fill={on ? C.primary : "none"} />
    </Pressable>
  );
}
