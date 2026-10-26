// 내 위치(GPS) 표시. 거래 마커와 헷갈리지 않게 지도 앱에서 흔히 쓰는 파란 점과 옅은 원으로 그린다
import type { FeatureCollection } from 'geojson';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
export type UserLocation = {
    lat: number;
    lng: number;
};
export const USER_LOCATION_SOURCE = 'user-location';
export const USER_LOCATION_COLOR = '#1A73E8';
export function userLocationFeatures(loc?: UserLocation | null): FeatureCollection {
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng) || Math.abs(loc.lat) > 90 || Math.abs(loc.lng) > 180)
        return { type: 'FeatureCollection', features: [] };
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { kind: 'user' }, geometry: { type: 'Point', coordinates: [loc.lng, loc.lat] } }] };
}
export const USER_HALO_LAYER: LayerSpecification = {
    id: 'user-location-halo', type: 'circle', source: USER_LOCATION_SOURCE,
    paint: { 'circle-radius': 22, 'circle-color': USER_LOCATION_COLOR, 'circle-opacity': 0.16 }
};
export const USER_DOT_LAYER: LayerSpecification = {
    id: 'user-location-dot', type: 'circle', source: USER_LOCATION_SOURCE,
    paint: { 'circle-radius': 8, 'circle-color': USER_LOCATION_COLOR, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 }
};
