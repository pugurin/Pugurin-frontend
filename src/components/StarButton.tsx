import React, { useContext } from "react";
import { Pressable } from "react-native";
import type { ComplexInput, RegionInput } from "../api/interests";
import { InterestsContext } from "../state/interests";
import { C } from "../theme/tokens";
import { Icon } from "./ui";

// 단지·지역 시트 제목 옆 관심 등록 ☆. 담겨 있으면 채운 별
export function StarButton(
  props:
    | { kind: "complex"; item: ComplexInput }
    | { kind: "region"; item: RegionInput },
) {
  const v = useContext(InterestsContext);
  const on =
    props.kind === "complex"
      ? v.hasComplex(props.item.complex_id)
      : v.hasRegion(props.item.region_code);
  const key =
    props.kind === "complex"
      ? `complex:${props.item.complex_id}`
      : `region:${props.item.region_code}`;
  const what = props.kind === "complex" ? "단지" : "지역";
  const busy = v.busy.includes(key);
  // 관심 기능을 열지 않은 빌드는 예전처럼 점선 비활성 모양. 누르면 준비 중 안내만 한다
  if (!v.enabled)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`관심 ${what} ${props.item.name}`}
        accessibilityHint="준비 중이에요"
        onPress={() =>
          props.kind === "complex"
            ? v.toggleComplex(props.item)
            : v.toggleRegion(props.item)
        }
        style={{
          padding: 12,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: C.disabled,
          borderRadius: 12,
        }}
      >
        <Icon name="star" color={C.light} />
      </Pressable>
    );
  // 이름은 어느 단지·지역인지만 말하고, 담겼는지는 눌림 상태(aria-pressed)로만 알린다
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`관심 ${what} ${props.item.name}`}
      accessibilityState={{ disabled: busy }}
      aria-pressed={on}
      disabled={busy}
      onPress={() =>
        props.kind === "complex"
          ? v.toggleComplex(props.item)
          : v.toggleRegion(props.item)
      }
      style={({ pressed }) => ({
        padding: 12,
        borderWidth: 1,
        borderColor: on ? C.greenRule : C.rule,
        backgroundColor: on ? C.greenWash : pressed ? C.bg2 : C.surface,
        borderRadius: 12,
      })}
    >
      <Icon
        name="star"
        color={on ? C.primary : C.muted}
        fill={on ? C.primary : "none"}
      />
    </Pressable>
  );
}
