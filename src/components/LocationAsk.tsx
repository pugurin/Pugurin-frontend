import React from "react";
import { Modal, Pressable, View } from "react-native";
import { C } from "../theme/tokens";
import { Btn, Icon, T } from "./ui";
// 첫 실행 위치 안내(#92). '허용하기'를 누르면 시스템 권한 창을 띄운다
export function LocationAsk({
  visible,
  onAllow,
  onLater,
}: {
  visible: boolean;
  onAllow: () => void;
  onLater: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onLater}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(17,17,16,.45)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Pressable
          accessibilityLabel="위치 권한 안내"
          style={{
            width: "100%",
            maxWidth: 400,
            backgroundColor: C.surface,
            borderRadius: 18,
            padding: 24,
            gap: 16,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: C.greenWash,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="locate" color={C.greenInk} />
          </View>
          <T size={22} bold>
            내 위치에서 지도를 볼까요?
          </T>
          <T size={17} color={C.muted}>
            위치를 허용하면 지금 계신 곳에 표시하고, 주변 실거래가부터
            보여드려요. 위치는 지도를 옮기는 데에만 써요.
          </T>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn secondary onPress={onLater} style={{ flex: 1 }}>
              나중에
            </Btn>
            <Btn onPress={onAllow} style={{ flex: 1.7 }}>
              위치 허용하기
            </Btn>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}
