import { useSyncExternalStore } from "react";
import { readRaw, subscribe } from "./storage";

const noopSubscribe = () => () => {};

/** false during SSR/hydration, true once running in the browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Raw sessionStorage string for `key`; re-renders when it changes. null on the server. */
export function useStoredRaw(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );
}
