import type {BBox, Deal, Filters, Latest, Marker, Property} from '../api/types';
export const PROPERTY: Record<Property,string> = {apartment:'아파트',officetel:'오피스텔',villa:'빌라',land:'토지'};
export const DEAL:Record<Deal,string> = {sale:'매매',jeonse:'전세',monthly:'월세'};
export const DEFAULT_FILTERS:Filters = {property_type:'apartment',deal_type:'sale',period_months:12,exclude_direct:false};
export const HOME = {lat:35.163,lng:129.145,zoom:15,bbox:[129.12,35.14,129.18,35.185] as BBox};
export function kakaoZoom(level:number) { return Math.max(0,Math.min(22,18-level)); }
export function changeProperty(f:Filters,p:Property):Filters {return {property_type:p,deal_type:p==='land'?'sale':f.deal_type,period_months:f.period_months,exclude_direct:f.exclude_direct};}
export function changeDeal(f:Filters,d:Deal):Filters {return {...changeProperty(f,f.property_type),deal_type:f.property_type==='land'?'sale':d};}
export function queryForFilters(f:Filters,bbox?:BBox,zoom?:number) {const q=new URLSearchParams();Object.entries(f).forEach(([k,v])=>{if(v!==undefined)q.set(k,String(v));});if(bbox)q.set('bbox',bbox.join(','));if(zoom!==undefined)q.set('zoom',String(Math.round(zoom)));return q;}
export function formatPrice(v:number|null|undefined) {if(v==null)return '정보 없음';return v>=1e8?`${(v/1e8).toFixed(1).replace(/\.0$/,'')}억`:`${Math.round(v/1e4).toLocaleString('ko-KR')}만`;}
export const formatMan=(v:number|null|undefined)=>v==null?'—':Math.round(v/1e4).toLocaleString('ko-KR');
export function formatArea(a:Pick<Latest,'exclusive_area_pyeong'|'supply_area_pyeong'|'land_area_pyeong'>,unit:'평'|'㎡'='평') {if(a.land_area_pyeong!=null)return `${unit==='평'?a.land_area_pyeong:(a.land_area_pyeong*3.3058).toFixed(1)}${unit}`;const supply=a.supply_area_pyeong; const exclusive=a.exclusive_area_pyeong; if(supply!=null)return `${unit==='평'?supply: +(supply*3.3058).toFixed(1)}${unit}`;return exclusive==null?'면적 정보 없음':`전용 ${unit==='평'?exclusive:+(exclusive*3.3058).toFixed(1)}${unit}`;}
export const priceLabel=(l:Latest)=>l.deal_type==='sale'?formatPrice(l.price):l.deal_type==='jeonse'?`전세 ${formatPrice(l.deposit)}`:`${formatMan(l.deposit)}/${formatMan(l.monthly_rent)}`;
export const markerId=(m:Marker)=>m.kind==='region'?m.region_code:m.kind==='complex'?m.complex_id:m.transaction_id;
export function markerLabel(m:Marker) {if(m.kind!=='region')return priceLabel(m.latest);const s=m.summary;if(s.median_price_per_pyeong!=null)return `평당 ${formatPrice(s.median_price_per_pyeong)}`;if(s.median_deposit_per_pyeong!=null)return `평당 보증금 ${formatPrice(s.median_deposit_per_pyeong)}`;return `보증금 ${formatMan(s.median_deposit)} · 월 ${formatMan(s.median_monthly_rent)}`;}
export const inBusan=(lat:number,lng:number)=>lat>=34.85&&lat<=35.4&&lng>=128.75&&lng<=129.35;
export type Draft={period:string;priceMin:string;priceMax:string;depositMin:string;depositMax:string;rentMin:string;rentMax:string;areaMin:string;areaMax:string;exclude:boolean};
export function draftFor(f:Filters):Draft {return {period:String(f.period_months),priceMin:f.price_min==null?'':String(f.price_min/1e8),priceMax:f.price_max==null?'':String(f.price_max/1e8),depositMin:f.deposit_min==null?'':String(f.deposit_min/1e8),depositMax:f.deposit_max==null?'':String(f.deposit_max/1e8),rentMin:f.rent_min==null?'':String(f.rent_min/1e4),rentMax:f.rent_max==null?'':String(f.rent_max/1e4),areaMin:String((f.property_type==='land'?f.land_area_pyeong_min:f.exclusive_area_pyeong_min)??''),areaMax:String((f.property_type==='land'?f.land_area_pyeong_max:f.exclusive_area_pyeong_max)??''),exclude:f.exclude_direct};}
export function validateDraft(f:Filters,d:Draft):{filters?:Filters;error?:string} {
 const n=Number(d.period);if(!Number.isInteger(n)||n<1||n>60)return {error:'기간은 1~60개월로 입력해 주세요'};
 const result=changeProperty(f,f.property_type);result.period_months=n;result.exclude_direct=d.exclude;
 const pairs:[string,string,string,number][]=[];
 if(f.deal_type==='sale')pairs.push(['price',d.priceMin,d.priceMax,1e8]);else pairs.push(['deposit',d.depositMin,d.depositMax,1e8]);
 if(f.deal_type==='monthly')pairs.push(['rent',d.rentMin,d.rentMax,1e4]);
 pairs.push([f.property_type==='land'?'land_area_pyeong':'exclusive_area_pyeong',d.areaMin,d.areaMax,1]);
 for(const [key,lo,hi,mul] of pairs){const min=lo.trim()===''?undefined:Number(lo);const max=hi.trim()===''?undefined:Number(hi);if([min,max].some(x=>x!==undefined&&(!Number.isFinite(x)||x<0)))return {error:'0 이상의 숫자를 입력해 주세요'};if(min!==undefined&&max!==undefined&&min>max)return {error:'최소값은 최대값보다 작거나 같아야 해요'};if(min!==undefined)Object.assign(result,{[`${key}_min`]:Math.round(min*mul*10)/10});if(max!==undefined)Object.assign(result,{[`${key}_max`]:Math.round(max*mul*10)/10});}
 return {filters:result};
}
