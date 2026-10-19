// 실제 클릭 좌표와 서버가 제공한 필지 경계만 표시한다. 거래 데이터는 만들지 않는다.
import type { FeatureCollection, Geometry, Feature } from 'geojson';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
export type SelectionPoint = {
    lat: number;
    lng: number;
};
export const SELECTION_SOURCE = 'land-selection';
export function selectionFeatures(point?: SelectionPoint, parcel?: Geometry | null): FeatureCollection {
    const features: Feature[] = [];
    if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180)
        features.push({ type: 'Feature', properties: { kind: 'selection' }, geometry: { type: 'Point', coordinates: [point.lng, point.lat] } });
    if (parcel)
        features.push({ type: 'Feature', properties: { kind: 'parcel' }, geometry: parcel });
    return { type: 'FeatureCollection', features };
}
export const PARCEL_FILL_LAYER: LayerSpecification = {
    id: 'land-selection-fill', type: 'fill', source: SELECTION_SOURCE,
    filter: ['all', ['==', ['get', 'kind'], 'parcel'], ['==', ['geometry-type'], 'Polygon']],
    paint: { 'fill-color': '#3f9a3a', 'fill-opacity': 0.1 }
};
export const PARCEL_LINE_LAYER: LayerSpecification = {
    id: 'land-selection-boundary', type: 'line', source: SELECTION_SOURCE,
    filter: ['all', ['==', ['get', 'kind'], 'parcel'], ['in', ['geometry-type'], ['literal', ['Polygon', 'LineString']]]],
    paint: { 'line-color': '#3f9a3a', 'line-width': 2.5 }
};
export const SELECTION_CIRCLE_LAYER: LayerSpecification = {
    id: 'land-selection-point', type: 'circle', source: SELECTION_SOURCE,
    filter: ['==', ['get', 'kind'], 'selection'],
    paint: { 'circle-radius': 10, 'circle-color': '#FFFFFF', 'circle-opacity': 0.9, 'circle-stroke-color': '#3f9a3a', 'circle-stroke-width': 3 }
};
