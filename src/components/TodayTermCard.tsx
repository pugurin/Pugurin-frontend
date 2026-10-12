// 지도 홈 하단 '오늘의 용어' 카드 (와이어프레임 01-glossary-tips D01)
import React from "react";
import { Pressable, View } from "react-native";
import type { Term } from "../api/types";
import { C } from "../theme/tokens";
import { T } from "./ui";

export function TodayTermCard({
  term,
  onOpen,
  onClose,
}: {
  term: Term;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <View
      style={{
        height: 64,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.rule,
        borderRadius: 12,
        paddingLeft: 14,
        paddingRight: 4,
        boxShadow: "0 1px 2px rgba(17,17,16,.12),0 3px 10px rgba(17,17,16,.14)",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`오늘의 용어 ${term.term} 자세히 보기`}
        onPress={onOpen}
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T size={13} bold color={C.muted}>
            오늘의 용어 ·{" "}
            <T size={17} bold color={term.category === "land" ? C.land : C.ink}>
              {term.term}
            </T>
          </T>
          <T size={15} color={C.ink2} numberOfLines={1}>
            {term.short_definition}
          </T>
        </View>
        <T size={20} color={C.ink2}>
          ›
        </T>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="오늘의 용어 닫기"
        onPress={onClose}
        style={{
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          borderLeftWidth: 1,
          borderColor: C.bg2,
        }}
      >
        <T size={18} color={C.light}>
          ✕
        </T>
      </Pressable>
    </View>
  );
}
