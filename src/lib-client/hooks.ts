import { useEffect, useState, useSyncExternalStore } from "react";
import { getAiStatus } from "./api";
import { readRaw, subscribe } from "./storage";

let aiStatusPromise: Promise<boolean> | null = null;

function loadAiStatus(): Promise<boolean> {
  aiStatusPromise ??= getAiStatus()
    .then((s) => s.enabled === true)
    .catch(() => {
      aiStatusPromise = null; // allow a later retry
      return false;
    });
  return aiStatusPromise;
}

/** Whether OpenAI features are configured. null while loading; false on error. Fetched once per page load. */
export function useAiEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    loadAiStatus().then((v) => {
      if (live) setEnabled(v);
    });
    return () => {
      live = false;
    };
  }, []);
  return enabled;
}

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
