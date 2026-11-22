import React from "react";
import { Modal, Pressable, View } from "react-native";
import { C } from "../theme/tokens";
import { Btn, Icon, T } from "./ui";
// 로그인하지 않고 관심 별을 눌렀을 때 띄우는 안내. 아래에 취소·로그인 버튼을 나란히 둔다
export function LoginAsk({
  visible,
  onCancel,
  onLogin,
}: {
  visible: boolean;
  onCancel: () => void;
  onLogin: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      {/* 바깥 어두운 곳을 누르면 취소. 안쪽 카드는 Pressable이라 눌림이 바깥으로 새지 않는다 */}
      <Pressable
        accessibilityLabel="로그인 안내 닫기"
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: "rgba(17,17,16,.45)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Pressable
          accessibilityLabel="로그인 안내"
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
            <Icon name="star" color={C.greenInk} />
          </View>
          <T size={22} bold>
            로그인이 필요해요
          </T>
          <T size={17} color={C.muted}>
            로그인하면 관심 단지·경매를 저장하고, 어느 기기에서든 같은 목록을 볼
            수 있어요.
          </T>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn secondary onPress={onCancel} style={{ flex: 1 }}>
              취소
            </Btn>
            <Btn onPress={onLogin} style={{ flex: 1 }}>
              로그인
            </Btn>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
