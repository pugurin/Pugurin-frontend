import {describe,it,expect} from 'vitest';
import {Repository} from '../src/api/repository';
import {ApiClient} from '../src/api/client';
import {DEFAULT_FILTERS,HOME} from '../src/state/market';
describe('메인 API 계약',()=>{
 it('머지되지 않은 API를 요청하거나 샘플로 대체하지 않는다',async()=>{let calls=0;const repo=new Repository('api',new ApiClient('http://api','d',async()=>{calls++;return new Response('{}');}));for(const promise of [repo.stats(DEFAULT_FILTERS,'id','complex'),repo.stats(DEFAULT_FILTERS,'code','region'),repo.analysis('id'),repo.transactions(DEFAULT_FILTERS,{bbox:HOME.bbox})])await expect(promise).rejects.toMatchObject({code:'API_PENDING'});expect(calls).toBe(0);});
 it('검색과 단지 이력은 실제 계약에 있는 필드로 요청한다',async()=>{const urls:string[]=[];const repo=new Repository('api',new ApiClient('http://api','d',async url=>{urls.push(String(url));return new Response(JSON.stringify({data:[]}));}));await repo.search('해운대');await repo.transactions(DEFAULT_FILTERS,{complexId:'id',cancelled:true,page:2,sort:'price_asc'});expect(urls[0]).toContain('/search?q=');expect(urls[1]).toContain('/complexes/id/transactions?');expect(urls[1]).toContain('include_cancelled=true');expect(urls[1]).not.toContain('period_months');});
});
