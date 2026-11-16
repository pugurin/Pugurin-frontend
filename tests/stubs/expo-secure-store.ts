// 테스트용 expo-secure-store. 진짜 모듈은 expo-modules-core를 불러와 jsdom에서 __DEV__ 오류가 난다
const data = new Map<string, string>();
export const getItemAsync = async (k: string) => data.get(k) ?? null;
export const setItemAsync = async (k: string, v: string) => void data.set(k, v);
export const deleteItemAsync = async (k: string) => void data.delete(k);
