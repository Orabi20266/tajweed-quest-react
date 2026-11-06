import { useCallback, useEffect, useRef, useState } from "react";
import {
  STORAGE_KEY,
  IP_STORAGE_PREFIX,
  LEGACY_STORAGE_KEY,
  LEGACY_IP_STORAGE_PREFIX,
  emptyProgress,
  mergeProgress,
  normalizeProgress,
  readStore,
  writeStore
} from "../lib/game.js";

/**
 * يحفظ التقدم على الجهاز، ويعكسه أيضاً في مفتاح مرتبط بعنوان IP
 * حتى يجد الطالب تقدمه عند العودة من نفس الشبكة.
 * وينقل تقدم النسخة القديمة (HTML) تلقائياً عند توفره.
 */
export function useProgress() {
  const [progress, setProgress] = useState(() => {
    const current = readStore(STORAGE_KEY);
    if (current) return normalizeProgress(current);
    const legacy = readStore(LEGACY_STORAGE_KEY);
    return normalizeProgress(legacy ?? emptyProgress());
  });
  const [saveState, setSaveState] = useState("local"); // local | linked
  const ipRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    (async () => {
      try {
        const response = await fetch("https://api.ipify.org?format=json", {
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) throw new Error("IP service unavailable");
        const data = await response.json();
        if (!alive || !data?.ip) return;

        const ip = String(data.ip);
        const ipProfile =
          readStore(IP_STORAGE_PREFIX + ip) ?? readStore(LEGACY_IP_STORAGE_PREFIX + ip);
        if (ipProfile) {
          setProgress((current) => mergeProgress(current, ipProfile));
        }
        ipRef.current = ip;
        setSaveState("linked");
      } catch {
        if (alive) setSaveState("local");
      } finally {
        clearTimeout(timeoutId);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const stamped = { ...progress, updatedAt: Date.now() };
    writeStore(STORAGE_KEY, stamped);
    if (ipRef.current) {
      writeStore(IP_STORAGE_PREFIX + ipRef.current, {
        best: progress.best,
        fastest: progress.fastest,
        recitation: progress.recitation,
        session: progress.session,
        updatedAt: stamped.updatedAt
      });
    }
  }, [progress]);

  const recordResult = useCallback(({ levelIndex, percent, elapsed, passed }) => {
    setProgress((current) => {
      const best = { ...current.best };
      const fastest = { ...current.fastest };

      if (percent > (best[levelIndex] ?? 0)) best[levelIndex] = percent;

      if (passed && elapsed > 0) {
        const previous = fastest[levelIndex];
        if (!previous || elapsed < previous) fastest[levelIndex] = elapsed;
      }

      return { ...current, best, fastest, session: null, updatedAt: Date.now() };
    });
  }, []);

  const recordRecitation = useCallback(({ id, percent }) => {
    const safe = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));

    setProgress((current) => {
      const previous = current.recitation?.[id];
      return {
        ...current,
        recitation: {
          ...current.recitation,
          [id]: {
            best: Math.max(previous?.best ?? 0, safe),
            attempts: (previous?.attempts ?? 0) + 1,
            updatedAt: Date.now()
          }
        }
      };
    });
  }, []);

  const saveSession = useCallback((session) => {
    setProgress((current) => ({
      ...current,
      session: { ...session, updatedAt: Date.now() }
    }));
  }, []);

  const clearSession = useCallback(() => {
    setProgress((current) => (current.session ? { ...current, session: null } : current));
  }, []);

  const setSound = useCallback((enabled) => {
    setProgress((current) => ({ ...current, sound: enabled }));
  }, []);

  const resetAll = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      if (ipRef.current) {
        localStorage.removeItem(IP_STORAGE_PREFIX + ipRef.current);
        localStorage.removeItem(LEGACY_IP_STORAGE_PREFIX + ipRef.current);
      }
    } catch {
      /* التخزين غير متاح */
    }
    setProgress({ ...emptyProgress(), updatedAt: Date.now() });
  }, []);

  return {
    progress,
    saveState,
    recordResult,
    recordRecitation,
    saveSession,
    clearSession,
    setSound,
    resetAll
  };
}
