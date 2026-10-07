import { describe, it, expect } from 'vitest';
import { changeProperty, queryForFilters, formatPrice, formatArea, kakaoZoom, validateDraft } from '../src/state/market';
const base = { property_type: 'apartment' as const, deal_type: 'sale' as const, period_months: 12, exclude_direct: false };
describe('지도 필터와 표시 계약', () => {
 it('월세에서 토지로 바꾸면 매매로 고정하고 호환되지 않는 필터를 제거한다', () => {
  const result = changeProperty({...base, deal_type: 'monthly', deposit_min: 50000000, rent_max: 800000, exclusive_area_pyeong_min: 20}, 'land');
  expect(result).toEqual({...base, property_type: 'land'});
 });
 it('카카오 줌 레벨은 백엔드 표준 줌과 반대 방향으로 변환한다', () => { expect(kakaoZoom(3)).toBe(15); expect(kakaoZoom(7)).toBe(11); });
 it('요청 가격은 억·만원 입력을 원으로 바꾼다', () => {
  const result = validateDraft(base, {period:'12',priceMin:'3.5',priceMax:'15',depositMin:'',depositMax:'',rentMin:'',rentMax:'',areaMin:'20',areaMax:'40',exclude:false});
  expect(result.error).toBeUndefined(); expect(result.filters?.price_min).toBe(350000000);
  const q = queryForFilters(result.filters!, [129,35,129.2,35.2],15);
  expect(q.get('price_min')).toBe('350000000'); expect(q.get('exclusive_area_pyeong_min')).toBe('20'); expect(q.has('deposit_min')).toBe(false);
 });
 it('최소값이 최대값을 초과하면 저장을 거절한다', () => {
  const result = validateDraft(base, {period:'12',priceMin:'10',priceMax:'3',depositMin:'',depositMax:'',rentMin:'',rentMax:'',areaMin:'',areaMax:'',exclude:false});
  expect(result.error).toContain('최소');
 });
 it('미입력 가격을 0원으로 표시하지 않고 공급 평형이 없으면 전용임을 밝힌다', () => {
  expect(formatPrice(null)).toBe('정보 없음'); expect(formatPrice(1450000000)).toBe('14.5억'); expect(formatPrice(98000000)).toBe('9,800만');
  expect(formatArea({exclusive_area_pyeong:25.7,supply_area_pyeong:null})).toBe('전용 25.7평');
 });
});
