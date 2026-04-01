"use client";
import { useEffect } from "react";
import { SWRConfig } from "swr";

export function SWRConfigProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    console.log(
      "%c█▀█ █\n█▄▄ █▄█ █▀█ █ █▀█ █▀█ █▀▄\n\n%c✨ Luminar AI\nhttps://github.com/LanayruLakeDev/Luminar-AI",
      "color: #00d4ff; font-weight: bold; font-family: monospace; font-size: 16px; text-shadow: 0 0 10px #00d4ff;",
      "color: #888; font-size: 12px;",
    );
  }, []);

  return (
    <SWRConfig
      value={{
        provider: () => {
          // Create a map from localStorage cache
          const cache = new Map<string, any>(
            JSON.parse(localStorage.getItem("swr-cache") || "[]"),
          );

          // Save cache on unload
          window.addEventListener("beforeunload", () => {
            const appCache = JSON.stringify(Array.from(cache.entries()));
            localStorage.setItem("swr-cache", appCache);
          });

          return cache;
        },
        focusThrottleInterval: 30000,
        dedupingInterval: 2000,
        errorRetryCount: 1,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
