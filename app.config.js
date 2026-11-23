// app.json에 카카오 로그인 네이티브 설정을 더한다.
// 카카오 네이티브 앱 키(EXPO_PUBLIC_KAKAO_NATIVE_KEY)가 있을 때만 넣는다. 키는 앱에 들어가는 공개 값이라
// 카카오 개발자 콘솔에서 Android 키 해시·iOS 번들 ID로 제한한다
module.exports = ({ config }) => {
  const kakaoAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_KEY;
  if (!kakaoAppKey) return config;
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ["@react-native-seoul/kakao-login", { kakaoAppKey }],
      [
        "expo-build-properties",
        { android: { extraMavenRepos: ["https://devrepo.kakao.com/nexus/content/groups/public/"] } },
      ],
    ],
  };
};
