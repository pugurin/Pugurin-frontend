import React, { useContext, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { LearningContext } from "../glossary/LearningContext";
import { TERMS } from "../api/terms";
import { C } from "../theme/tokens";
import { T } from "./ui";
let previous = "";
export function LoadingTip({
  loading,
  context,
  error = false,
  clickable = true,
  enabled,
}: {
  loading: boolean;
  context: "complex" | "land" | "all";
  error?: boolean;
  clickable?: boolean;
  enabled?: boolean;
}) {
  const { terms, tipsEnabled, onTerm } = useContext(LearningContext);
  const [show, setShow] = useState(false);
  const [term, setTerm] = useState<(typeof TERMS)[number] | null>(null);
  const allow = enabled ?? tipsEnabled;
  useEffect(() => {
    setShow(false);
    if (!loading || error || !allow) return;
    const timer = setTimeout(() => {
      const source = terms.length ? terms : TERMS.slice(0, 10);
      const choices = source.filter(
        (t) =>
          context === "all" ||
          (context === "land"
            ? t.category === "land"
            : ["building", "trade"].includes(t.category)),
      );
      const next = choices.find((t) => t.id !== previous) ?? choices[0];
      if (next) {
        previous = next.id;
        setTerm(next);
        setShow(true);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [loading, error, allow, context, terms]);
  if (!allow || !loading || error || !show || !term) return null;
  return (
    <View
      style={{
        marginVertical: 16,
        padding: 16,
        borderRadius: 14,
        backgroundColor: C.greenWash,
        borderWidth: 1,
        borderColor: C.greenRule,
        gap: 7,
      }}
    >
      <T size={13} color={C.greenInk}>
        불러오는 동안
      </T>
      <T bold color={C.greenInk}>
        {term.term}
      </T>
      <T color={C.ink2}>{term.short_definition}</T>
      {clickable && onTerm && (
        <Pressable onPress={() => onTerm(term)} accessibilityRole="button">
          <T bold color={C.greenInk} style={{ paddingVertical: 8 }}>
            용어 자세히 ›
          </T>
        </Pressable>
      )}
    </View>
  );
}
