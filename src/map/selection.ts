// 실제 클릭 좌표와 서버가 제공한 필지 경계만 표시한다. 거래 데이터는 만들지 않는다.
import type { FeatureCollection, Geometry, Feature } from 'geojson';
export type SelectionPoint = {
    lat: number;
    lng: number;
};
export const SELECTION_COLOR = '#3f9a3a';
export function selectionFeatures(point?: SelectionPoint, parcel?: Geometry | null): FeatureCollection {
    const features: Feature[] = [];
    if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180)
        features.push({ type: 'Feature', properties: { kind: 'selection' }, geometry: { type: 'Point', coordinates: [point.lng, point.lat] } });
    if (parcel)
        features.push({ type: 'Feature', properties: { kind: 'parcel' }, geometry: parcel });
    return { type: 'FeatureCollection', features };
}
