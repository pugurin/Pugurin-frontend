import assert from "node:assert/strict";
const base = process.env.PUGURIN_VERIFY_API || "http://127.0.0.1:8000/api/v1";
const headers = { "X-Device-Id": "af2c97d7-a813-42ec-a3df-170fd03f9162" };
const checked = [];
async function get(path) {
  const r = await fetch(base + path, { headers });
  assert.equal(r.status, 200, `${path}: ${r.status}`);
  const j = await r.json();
  assert.ok(j.data !== undefined, path);
  checked.push(path);
  return j;
}
const m = await get(
  "/map/markers?bbox=128.75,34.85,129.35,35.40&zoom=15&property_type=apartment&deal_type=sale&period_months=60",
);
assert.ok(m.data.markers.length > 0);
const c = m.data.markers.find((m) => m.kind === "complex");
assert.ok(c);
const d = await get(`/complexes/${c.complex_id}`);
assert.equal(d.data.id, c.complex_id);
for (const deal of ["sale", "jeonse", "monthly"]) {
  const t = await get(
    `/complexes/${c.complex_id}/transactions?deal_type=${deal}&exclude_direct=true&include_cancelled=true&sort=price_asc&page=1&page_size=20`,
  );
  assert.ok(Array.isArray(t.data));
  assert.ok(t.meta.total_pages >= 0);
}
const s = await get(`/search?q=${encodeURIComponent(c.name)}&limit=30`);
assert.ok(s.data.some((r) => r.complex_id === c.complex_id));
const reg = await get(
  "/search?q=" + encodeURIComponent("해운대") + "&limit=30",
);
assert.ok(reg.data.some((r) => r.type === "region"));
for (const deal of ["sale", "jeonse", "monthly"]) {
  const stats = await get(
    `/complexes/${c.complex_id}/stats?property_type=apartment&deal_type=${deal}&period_months=36`,
  );
  assert.equal(stats.data.trend.length, 36);
  assert.ok(Array.isArray(stats.data.area_types));
  const region = await get(
    `/stats/regions/${d.data.region_code}?property_type=apartment&deal_type=${deal}&period_months=12&exclude_direct=true`,
  );
  assert.equal(region.data.trend.length, 12);
  const metric =
    deal === "sale"
      ? "median_price_per_pyeong"
      : deal === "jeonse"
        ? "median_deposit_per_pyeong"
        : "median_monthly_rent";
  assert.ok(metric in stats.data);
  assert.ok(region.meta.method.includes("직거래 제외"));
}
const terms = await get("/glossary");
assert.ok(terms.data.length);
const term = await get("/glossary/" + terms.data[0].id);
assert.equal(term.data.id, terms.data[0].id);
const response = await fetch(base + "/glossary", { headers });
const etag = response.headers.get("etag");
assert.ok(etag);
assert.equal(
  (
    await fetch(base + "/glossary", {
      headers: { ...headers, "If-None-Match": etag },
    })
  ).status,
  304,
);
const bad = await fetch(base + "/search?q=a", { headers });
assert.equal(bad.status, 400);
console.log(
  JSON.stringify(
    {
      checked,
      data_mode: response.headers.get("x-data-mode"),
      etag_304: true,
      search_validation_400: true,
    },
    null,
    2,
  ),
);
