// 화면 여기저기서 "레퍼런스가 새로 생겼어요"를 알리는 작은 방송국
import type { Ref } from "@/lib/refs";

type Listener = (ref: Ref) => void;
const listeners = new Set<Listener>();

export function onRefCreated(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitRefCreated(ref: Ref) {
  listeners.forEach((fn) => fn(ref));
}
