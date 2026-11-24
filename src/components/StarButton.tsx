import React, { useContext } from "react";
import { Pressable } from "react-native";
import type { InterestKind } from "../api/types";
import { InterestsContext } from "../state/interests";
import { C } from "../theme/tokens";
import { Icon } from "./ui";

// 단지·경매 시트 제목 옆, 관심 목록 줄 끝의 관심 등록 ★. 담겨 있으면 채운 별과 강조색
// name을 주면 라벨에 넣어 목록에서 어느 단지·물건의 별인지 읽히게 한다
export function StarButton({
  kind,
  id,
  name,
}: {
  kind: InterestKind;
  id: string;
  name?: string;
}) {
  const v = useContext(InterestsContext);
  const on = v.has(kind, id);
  const what = kind === "complex" ? "단지" : "경매";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name ? `${name} ` : ""}관심 ${what} ${on ? "해제" : "등록"}`}
      aria-pressed={on}
      onPress={() => v.toggle(kind, id)}
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
