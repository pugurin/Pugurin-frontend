// react-native-webview는 네이티브 전용이라 jsdom 테스트에서는 빈 컴포넌트로 바꾼다
import React from "react";
export const WebView = React.forwardRef((_props: object, _ref) => null);
export default WebView;
