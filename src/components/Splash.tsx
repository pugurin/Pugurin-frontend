// 처음 열 때 화면 (와이어프레임 01-glossary-tips T01 스플래시 · 로딩 팁)
import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { C } from "../theme/tokens";
import { LoadingTip } from "./LoadingTip";
import { T } from "./ui";

const BAR = 200;

export function Splash() {
  // 진행 정도를 알 수 없어 막대 일부가 왼쪽에서 오른쪽으로 계속 지나가게 한다
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
        }}
      >
        <View
          style={{
            borderWidth: 2,
            borderColor: C.ink,
            paddingHorizontal: 22,
            paddingVertical: 8,
          }}
        >
          <T size={22} bold style={{ letterSpacing: 2 }}>
            퍼그린
          </T>
        </View>
        <T size={22} bold>
          부산 실거래가 지도
        </T>
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 28, gap: 18 }}>
        <View style={{ alignItems: "center", gap: 8 }}>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="실거래가를 불러오고 있어요"
            style={{
              width: BAR,
              height: 6,
              borderRadius: 3,
              backgroundColor: C.rule,
              overflow: "hidden",
            }}
          >
            <Animated.View
              style={{
                width: BAR * 0.55,
                height: "100%",
                borderRadius: 3,
                backgroundColor: C.ink,
                transform: [
                  {
                    translateX: x.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-BAR * 0.55, BAR],
                    }),
                  },
                ],
              }}
            />
          </View>
          <T size={15} color={C.muted}>
            실거래가를 불러오고 있어요
          </T>
        </View>
        {/* 1초 넘게 걸리면 기본 팁. 누를 수 없고, 로딩이 끝나면 바로 지도로 넘어간다 */}
        <LoadingTip context="splash" terms={[]} linked={false} />
      </View>
    </View>
  );
}
