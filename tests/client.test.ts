import { describe, it, expect } from 'vitest';
import { ApiClient } from '../src/api/client';
describe('API 응답 처리', () => {
 it('X-Device-Id를 전송하고 성공 응답 data를 보존한다', async () => {
  let headers: Headers | undefined;
  const client = new ApiClient('http://localhost:8000/api/v1','device-uuid', async (_url, init) => { headers = new Headers(init?.headers); return new Response(JSON.stringify({data:[{id:'1'}],meta:{}})); });
  const r = await client.get('/glossary'); expect(headers?.get('X-Device-Id')).toBe('device-uuid'); expect(r.data).toEqual([{id:'1'}]);
 });
 it('304 응답은 이전 캐시를 사용한다', async () => {
  let call=0;
  const client = new ApiClient('http://localhost/api/v1','d',async()=>++call===1?new Response(JSON.stringify({data:{level:'dong'},meta:{}}),{headers:{ETag:'abc'}}):new Response(null,{status:304}));
  const first = await client.get('/map/markers'); const second = await client.get('/map/markers'); expect(second).toEqual(first);
 });
 it('429 에러는 다시 시도할 시간을 전달한다', async () => {
  const client = new ApiClient('http://localhost/api/v1','d',async()=>new Response(JSON.stringify({error:{code:'RATE_LIMITED',message:'잠시 후 다시 시도해 주세요'}}),{status:429,headers:{'Retry-After':'30'}}));
  await expect(client.get('/glossary')).rejects.toMatchObject({code:'RATE_LIMITED',retryAfter:30});
 });
});
