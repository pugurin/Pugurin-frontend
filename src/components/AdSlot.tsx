import React from "react";
import { Pressable, View } from "react-native";
import { C } from "../theme/tokens";
import { Icon, T } from "./ui";

// 작은 광고창 자리 (#129). 광고 공급처(애드핏·애드몹 등)가 정해지기 전까지
// 자리표시만 그린다. 실제 광고 연동은 별도 이슈에서 이 컴포넌트 안을 바꾼다.
export type AdPlacement = "map" | "sheet";

export function AdSlot({
  placement,
  onClose,
}: {
  placement: AdPlacement;
  onClose: () => void;
}) {
  const floating = placement === "map";
  return (
    <View
      testID={`ad-slot-${placement}`}
      accessibilityLabel="광고"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 52,
        paddingLeft: 12,
        paddingRight: 4,
        paddingVertical: 6,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.rule,
        borderRadius: floating ? 12 : 10,
        ...(floating
          ? {
              boxShadow:
                "0 1px 2px rgba(17,17,16,.12),0 3px 10px rgba(17,17,16,.14)",
            }
          : null),
      }}
    >
      <View
        style={{
          paddingHorizontal: 5,
          paddingVertical: 1,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: C.light,
        }}
      >
        <T size={11} bold color={C.muted}>
          광고
        </T>
      </View>
      <View style={{ flex: 1 }}>
        <T size={14} bold color={C.ink2} numberOfLines={1}>
          광고가 들어갈 자리예요
        </T>
        <T size={12} color={C.light} numberOfLines={1}>
          광고 연동 준비 중
        </T>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="광고 닫기"
        onPress={onClose}
        hitSlop={8}
        style={{
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="close" size={18} color={C.muted} />
      </Pressable>
    </View>
  );
}
