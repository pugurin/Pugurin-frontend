// maplibre-gl 웹 워커를 public/maplibre/로 복사한다.
// Metro 번들러는 maplibre-gl이 상대 경로로 여는 워커 파일을 처리하지 못해서, 정적 파일로 따로 서빙한다.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
const out = new URL("../public/maplibre/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"])
  copyFileSync(join(dist, f), join(out, f));
console.log("maplibre-gl 워커 복사:", out);
