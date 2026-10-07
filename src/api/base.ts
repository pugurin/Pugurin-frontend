// 기존 spike의 EXPO_PUBLIC_API_BASE(서버 주소)와 새 API_URL 모두 지원한다.
export function apiBase(value:string){const base=value.replace(/\/+$/,'');return base.endsWith('/api/v1')?base:`${base}/api/v1`;}
