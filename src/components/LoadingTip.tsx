// 로딩 중 용어 팁 카드 (와이어프레임 01-glossary-tips T01 스플래시, T02 시트 로딩)
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import type { Term } from "../api/types";
import { useGlossary } from "../glossary/context";
import { pickTip, TIP_DELAY_MS, type TipContext } from "../glossary/tips";
import { C } from "../theme/tokens";
import { T } from "./ui";

export function LoadingTip({
  context,
  terms: given,
  linked = true,
  delayMs = TIP_DELAY_MS,
}: {
  context: TipContext;
  // 스플래시는 컨텍스트가 없어 직접 넘긴다(비우면 앱에 넣어 둔 기본 용어)
  terms?: Term[];
  // false면 누를 수 없다(스플래시)
  linked?: boolean;
  // 0이면 바로 보여준다(유형 탭 전환처럼 일부러 기다리는 화면)
  delayMs?: number;
}) {
  const glossary = useGlossary();
  const [tip, setTip] = useState<Term | null>(() =>
    delayMs > 0 ? null : pickTip(given ?? glossary.terms, context),
  );
  // 로딩이 1초를 넘을 때만 고른다. 팁 때문에 로딩을 늦추지 않는다
  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = setTimeout(
      () => setTip(pickTip(given ?? glossary.terms, context)),
      delayMs,
    );
    return () => clearTimeout(timer);
  }, []);
  if (!tip) return null;
  return (
    <View
      accessibilityLabel={`알아 두면 좋은 용어, ${tip.term}`}
      style={{
        alignSelf: "stretch",
        backgroundColor: C.bg2,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: linked ? 4 : 14,
        gap: 4,
      }}
    >
      <T size={14} bold color={C.muted}>
        {linked ? "불러오는 동안" : "알아 두면 좋은 용어"}
      </T>
      <T size={18} bold color={tip.category === "land" ? C.land : C.ink}>
        {tip.term}
      </T>
      <T size={15} color={C.ink2} style={{ lineHeight: 23 }}>
        {tip.short_definition}
      </T>
      {linked && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${tip.term} 용어 자세히 보기`}
          onPress={() => glossary.openTerm(tip)}
          style={{ minHeight: 48, justifyContent: "center" }}
        >
          <T size={15} bold>
            용어 자세히 ›
          </T>
        </Pressable>
      )}
    </View>
  );
}
