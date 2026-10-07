import React, { useRef } from "react";
import {
  PanResponder,
  View,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { C } from "../theme/tokens";
import { IconBtn } from "./ui";
export type SheetStage = "peek" | "half" | "full";
export function Sheet({
  stage,
  onStage,
  onClose,
  children,
  peek = 230,
}: {
  stage: SheetStage;
  onStage: (s: SheetStage) => void;
  onClose: () => void;
  children: React.ReactNode;
  peek?: number;
}) {
  const { height } = useWindowDimensions();
  const latest = useRef({ stage, onStage, onClose });
  latest.current = { stage, onStage, onClose };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
      onPanResponderRelease: (_, g) => {
        const p = latest.current;
        if (g.dy < -35) p.onStage(p.stage === "peek" ? "half" : "full");
        if (g.dy > 45) {
          if (p.stage === "peek") p.onClose();
          else p.onStage(p.stage === "full" ? "half" : "peek");
        }
      },
    }),
  ).current;
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height:
          stage === "full"
            ? "96%"
            : stage === "half"
              ? Math.min(490, height * 0.68)
              : peek,
        maxHeight: "96%",
        backgroundColor: C.surface,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        boxShadow: "0 -6px 20px rgba(17,17,16,.14)",
        overflow: "hidden",
        zIndex: 30,
      }}
    >
      <View
        {...pan.panHandlers}
        style={{ height: 38, alignItems: "center", justifyContent: "center" }}
      >
        <View
          style={{
            height: 5,
            width: 40,
            borderRadius: 3,
            backgroundColor: C.rule,
          }}
        />
        <View style={{ position: "absolute", right: 4, top: 0 }}>
          <IconBtn
            name="close"
            label="시트 닫기"
            onPress={onClose}
            style={{ width: 38, height: 38 }}
          />
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}
