import React from "react";
import { Pressable, View } from "react-native";
import type { Term } from "../api/types";
import { C } from "../theme/tokens";
import { T } from "./ui";
export function TodayTermCard({
  term,
  onOpen,
  onClose,
  streak = 0,
  completed = false,
  matched = 0,
}: {
  term?: Term;
  onOpen: () => void;
  // 없으면 닫기(✕)를 숨긴다. 용어 탭 입구는 닫을 수 없다
  onClose?: () => void;
  streak?: number;
  completed?: boolean;
  // 오늘 맞힌 짝 개수(0~5). 1~4면 진행 중이라 "이어서"로 보여준다
  matched?: number;
}) {
  const resuming = !completed && matched > 0;
  return (
    <View
      style={{
        height: 72,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.greenRule,
        borderRadius: 14,
        paddingLeft: 14,
        paddingRight: onClose ? 5 : 12,
        boxShadow: "0 2px 8px rgba(17,17,16,.1)",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          completed
            ? "오늘의 용어 학습 결과"
            : `오늘의 용어 짝 맞추기 ${resuming ? "이어서" : "시작"}`
        }
        onPress={onOpen}
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <T bold size={14} color={C.brown}>
            오늘의 용어{streak ? ` · ${streak}일 연속` : ""}
          </T>
          <T bold size={17}>
            {completed
              ? "오늘 다섯 단어를 익혔어요"
              : resuming
                ? `단어 5개 짝 맞추기 · ${matched}/5`
                : "단어 5개 짝 맞추기"}
          </T>
        </View>
        <View
          style={{
            paddingHorizontal: 13,
            paddingVertical: 10,
            borderRadius: 9,
            backgroundColor: completed ? C.greenWash : C.primary,
          }}
        >
          <T
            bold
            color={completed ? C.greenInk : C.surface}
            style={{ fontSize: 16, lineHeight: 20 }}
          >
            {completed ? "결과" : resuming ? "이어서" : "시작"}
          </T>
        </View>
      </Pressable>
      {onClose && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="오늘의 용어 닫기"
          onPress={onClose}
          style={{
            width: 38,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <T size={18} color={C.light}>
            ✕
          </T>
        </Pressable>
      )}
    </View>
  );
}
