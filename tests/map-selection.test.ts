import { describe, it, expect } from 'vitest';
import type { Geometry } from 'geojson';
import { selectionFeatures, SELECTION_CIRCLE_LAYER, PARCEL_FILL_LAYER, PARCEL_LINE_LAYER } from '../src/map/selection';
describe('지도에서 누른 실제 위치와 필지 선택', () => {
    it('거래 마커나 가격 없이 누른 좌표만 선택 점으로 표시한다', () => {
        const data = selectionFeatures({ lat: 35.160321, lng: 129.160987 });
        expect(data.features).toEqual([{ type: 'Feature', properties: { kind: 'selection' }, geometry: { type: 'Point', coordinates: [129.160987, 35.160321] } }]);
        expect(JSON.stringify(data)).not.toMatch(/price|amount|transaction|bbox/);
    });
    it('필지 경계가 없으면 좌표 주변 사각형을 만들지 않는다', () => {
        expect(selectionFeatures({ lat: 35.16, lng: 129.16 }, null).features).toHaveLength(1);
        expect(selectionFeatures(undefined, null).features).toEqual([]);
    });
    it('제공받은 실제 필지 Geometry를 좌표 변경 없이 표시한다', () => {
        const parcel: Geometry = { type: 'Polygon', coordinates: [[[129.16, 35.16], [129.17, 35.16], [129.17, 35.17], [129.16, 35.16]]] };
        const data = selectionFeatures({ lat: 35.16, lng: 129.16 }, parcel);
        expect(data.features[1]).toEqual({ type: 'Feature', properties: { kind: 'parcel' }, geometry: parcel });
        expect(data.features[1].geometry).toBe(parcel);
    });
    it('선택을 해제하거나 잘못된 좌표를 받으면 선택 점을 비운다', () => {
        for (const point of [undefined, { lat: NaN, lng: 129 }, { lat: 91, lng: 129 }, { lat: 35, lng: 181 }])
            expect(selectionFeatures(point).features).toEqual([]);
    });
    it('선택 점과 실제 필지 경계를 별도 녹색 레이어로 구분한다', () => {
        expect(SELECTION_CIRCLE_LAYER).toMatchObject({ type: 'circle', filter: ['==', ['get', 'kind'], 'selection'], paint: { 'circle-stroke-color': '#3f9a3a', 'circle-stroke-width': 3 } });
        expect(PARCEL_FILL_LAYER).toMatchObject({ type: 'fill', paint: { 'fill-color': '#3f9a3a', 'fill-opacity': 0.1 } });
        expect(PARCEL_LINE_LAYER).toMatchObject({ type: 'line', paint: { 'line-color': '#3f9a3a', 'line-width': 2.5 } });
    });
});
