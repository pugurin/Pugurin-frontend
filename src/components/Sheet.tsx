import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  View,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { C } from "../theme/tokens";
import { IconBtn } from "./ui";
import { dragHeight, releaseSheet, sheetStops } from "./sheetMotion";
export type SheetStage = "peek" | "half" | "full";
export function Sheet({
  stage,
  onStage,
  onClose,
  children,
  peek = 230,
  docked = false,
  panelWidth = 400,
}: {
  stage: SheetStage;
  onStage: (s: SheetStage) => void;
  onClose: () => void;
  children: React.ReactNode;
  peek?: number;
  docked?: boolean;
  panelWidth?: number;
}) {
  const { height } = useWindowDimensions();
  const [available, setAvailable] = useState(height - 54);
  const stops = sheetStops(available, peek);
  const position = useRef(new Animated.Value(stops[stage])).current;
  const live = useRef(stops[stage]);
  const dragging = useRef(false);
  const start = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);
  const total = useRef(0);
  const current = useRef({ stage, onStage, onClose, stops });
  current.current = { stage, onStage, onClose, stops };
  useEffect(() => {
    const id = position.addListener(({ value }) => {
      live.current = value;
    });
    return () => {position.stopAnimation();position.removeListener(id);};
  }, [position]);
  const snap = (target: number) =>
    Animated.spring(position, {
      toValue: target,
      useNativeDriver: false,
      tension: 190,
      friction: 28,
      overshootClamping: true,
    }).start();
  useEffect(() => {
    if (!dragging.current) snap(stops[stage]);
  }, [stage, available, peek]);
  const begin = () => {
    position.stopAnimation();
    dragging.current = true;
    start.current = live.current;
    total.current = 0;
    velocity.current = 0;
  };
  const move = (dy: number) => {
    total.current = dy;
    position.setValue(dragHeight(start.current, dy, current.current.stops));
  };
  const end = (vy: number, cancel = false) => {
    if (!dragging.current) return;
    dragging.current = false;
    const p = current.current;
    if (cancel) {
      snap(p.stops[p.stage]);
      return;
    }
    const target =
      Math.abs(total.current) < 4
        ? p.stage === "peek"
          ? "half"
          : p.stage === "half"
            ? "peek"
            : "half"
        : releaseSheet(live.current, vy, p.stops);
    if (target === "closed") {
      Animated.timing(position, {
        toValue: 0,
        duration: 170,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) p.onClose();
      });
      return;
    }
    snap(p.stops[target]);
    p.onStage(target);
  };
  const handlers = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 3,
      onPanResponderGrant: begin,
      onPanResponderMove: (_, g) => move(g.dy),
      onPanResponderRelease: (_, g) => end(g.vy),
      onPanResponderTerminate: () => end(0, true),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  // Web은 포인터 캡처로 손잡이를 벗어나도 드래그를 이어간다. 내용 스크롤은 따로 유지한다.
  const web: any = {
    onPointerDown: (e: any) => {
      if (e.button !== 0) return;
      begin();
      lastY.current = e.clientY;
      lastTime.current = performance.now();
      e.currentTarget.setPointerCapture(e.pointerId);
      startY.current = e.clientY;
    },
    onPointerMove: (e: any) => {
      if (!dragging.current) return;
      const time = performance.now();
      velocity.current =
        (e.clientY - lastY.current) / Math.max(1, time - lastTime.current);
      lastY.current = e.clientY;
      lastTime.current = time;
      move(e.clientY - startY.current);
    },
    onPointerUp: (e: any) => {
      end(performance.now() - lastTime.current > 100 ? 0 : velocity.current);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    },
    onPointerCancel: () => end(0, true),
    onKeyDown: (e: any) => {
      const p = current.current;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        p.onStage(p.stage === "peek" ? "half" : "full");
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        p.onStage(p.stage === "full" ? "half" : "peek");
      }
      if (e.key === "Escape") p.onClose();
    },
    tabIndex: 0,
  };
  const startY = useRef(0);
  return (
    <View
      pointerEvents="box-none"
      onLayout={(e) => setAvailable(e.nativeEvent.layout.height)}
      style={{ position: "absolute", inset: 0, zIndex: 30 }}
    >
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: docked ? undefined : 0,
          width: docked ? panelWidth : undefined,
          bottom: 0,
          height: docked ? "100%" : position,
          backgroundColor: C.surface,
          borderTopLeftRadius: docked ? 0 : 20,
          borderTopRightRadius: docked ? 0 : 20,
          boxShadow: "0 -6px 20px rgba(17,17,16,.14)",
          overflow: "hidden",
          borderRightWidth: docked ? 1 : 0,
          borderColor: C.rule,
        }}
      >
        <View
          style={{ height: 42, flexDirection: "row", alignItems: "center" }}
        >
          <View
            {...(!docked
              ? Platform.OS === "web"
                ? web
                : handlers.panHandlers
              : {})}
            accessibilityRole="adjustable"
            accessibilityLabel="시트 높이 조절"
            style={[
              {
                flex: 1,
                height: 42,
                alignItems: "center",
                justifyContent: "center",
              },
              Platform.OS === "web"
                ? ({
                    touchAction: "none",
                    userSelect: "none",
                    cursor: docked ? "default" : "ns-resize",
                  } as any)
                : {},
            ]}
          >
            {!docked && (
              <View
                style={{
                  height: 5,
                  width: 40,
                  borderRadius: 3,
                  backgroundColor: C.rule,
                }}
              />
            )}
          </View>
          <IconBtn
            name="close"
            label="시트 닫기"
            onPress={onClose}
            style={{ width: 42, height: 42 }}
          />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 28 }}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
