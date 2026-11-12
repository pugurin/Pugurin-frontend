import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "jsdom", include: ["tests/**/*.test.ts*"] },
  resolve: {
    alias: {
      "react-native": "react-native-web",
      "lucide-react-native": "lucide-react",
      "react-native-webview": "/tests/stubs/react-native-webview.tsx",
      "react-native-svg": "/tests/stubs/react-native-svg.tsx",
    },
  },
});
