import { SWRConfiguration } from "swr";

function localStorageProvider(): any {
  if (typeof window === "undefined") {
    return new Map();
  }

  const stored = localStorage.getItem("app-cache");
  const parsed = stored ? (JSON.parse(stored) as [string, unknown][]) : [];
  const map = new Map<string, unknown>(parsed);

  const saveCache = () => {
    const appCache = JSON.stringify(Array.from(map.entries()));
    localStorage.setItem("app-cache", appCache);
  };

  window.addEventListener("beforeunload", saveCache, { once: true });

  return map;
}

export const swrConfig: SWRConfiguration = {
  provider: localStorageProvider,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
};
