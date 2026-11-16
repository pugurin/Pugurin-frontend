import React from "react";
import { View } from "react-native";
import { T } from "./ui";
import { C } from "../theme/tokens";

// 닉네임 첫 글자를 넣은 동그라미
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: C.greenWash,
        borderWidth: 1,
        borderColor: C.greenRule,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <T bold size={size * 0.42} color={C.greenInk}>
        {name.slice(0, 1)}
      </T>
    </View>
  );
}
