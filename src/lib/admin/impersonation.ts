import { useSyncExternalStore } from "react";

const KEY = "lecto.impersonation";

export interface Impersonation {
  schoolId: string;
  schoolName: string;
}

const listeners = new Set<() => void>();
let cache: Impersonation | null | undefined;

function read(): Impersonation | null {
  if (typeof window === "undefined") return null;
  if (cache !== undefined) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Impersonation) : null;
  } catch {
    cache = null;
  }
  return cache;
}

function emit() {
  listeners.forEach((l) => l());
}

export function startImpersonation(value: Impersonation) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(value));
  cache = value;
  emit();
}

export function stopImpersonation() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  cache = null;
  emit();
}

export function getImpersonation() {
  return read();
}

export function useImpersonation(): Impersonation | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      // Mantém as abas sincronizadas quando a personificação muda em outra aba.
      const onStorage = (e: StorageEvent) => {
        if (e.key !== KEY) return;
        cache = undefined;
        emit();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    read,
    () => null,
  );
}
