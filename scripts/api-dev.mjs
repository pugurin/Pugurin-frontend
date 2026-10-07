// 브라우저 개발 전용. 백엔드에 CORS 설정이 없어 같은 PC의 API로 중계한다.
import http from 'node:http';
const target=process.env.PUGURIN_API_TARGET||'http://127.0.0.1:8000';
http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','X-Device-Id,If-None-Match,Content-Type');res.setHeader('Access-Control-Expose-Headers','ETag,Retry-After,X-Data-Mode');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 if(req.method!=='GET'||!req.url?.startsWith('/api/v1/')){res.writeHead(404);res.end();return;}
 try{const headers={};for(const k of ['x-device-id','if-none-match'])if(req.headers[k])headers[k]=req.headers[k];const response=await fetch(target+req.url,{headers});res.statusCode=response.status;for(const k of ['content-type','etag','retry-after','cache-control','x-data-mode']){const v=response.headers.get(k);if(v)res.setHeader(k,v);}res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'SOURCE_UNAVAILABLE',message:'백엔드 서버에 연결할 수 없어요'}}));}
}).listen(8001,'127.0.0.1',()=>console.log('개발 API 중계: http://localhost:8001/api/v1'));
