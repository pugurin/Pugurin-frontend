import React from "react";
import { Image, View } from "react-native";
import { T } from "./ui";
import { C } from "../theme/tokens";
export function Brand({
  size = 40,
  wordmark = false,
}: {
  size?: number;
  wordmark?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <View
        style={{
          width: size,
          height: size,
          overflow: "hidden",
          borderRadius: size * 0.2,
          backgroundColor: C.surface,
        }}
      >
        <Image
          source={require("../../assets/brand/logo.png")}
          accessibilityLabel="가지가지 로고"
          style={{
            position: "absolute",
            width: size * 1.8,
            height: size * 1.8,
            left: -size * 0.4,
            top: -size * 0.425,
          }}
        />
      </View>
      {wordmark && (
        <T bold color={C.brown} size={22}>
          가지가지
        </T>
      )}
    </View>
  );
}
