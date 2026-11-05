import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * مؤثرات صوتية مولّدة بـ Web Audio (بدون أي ملفات صوتية خارجية).
 */
export function useSound(enabled) {
  const enabledRef = useRef(enabled);
  const contextRef = useRef(null);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled && contextRef.current?.state === "running") {
      contextRef.current.suspend().catch(() => {});
    }
  }, [enabled]);

  const ensureContext = useCallback(() => {
    if (!enabledRef.current) return null;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      if (!contextRef.current) contextRef.current = new AudioCtor();
      if (contextRef.current.state === "suspended") contextRef.current.resume();
      return contextRef.current;
    } catch {
      return null;
    }
  }, []);

  const beep = useCallback(
    (frequency, start, duration, type = "sine", volume = 0.14, endFrequency) => {
      const context = ensureContext();
      if (!context) return;

      const startAt = context.currentTime + start;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startAt);
      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), startAt + duration);
      }

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.06);
    },
    [ensureContext]
  );

  return useMemo(
    () => ({
      click() {
        beep(660, 0, 0.07, "triangle", 0.06);
        beep(880, 0.06, 0.08, "triangle", 0.05);
      },
      correct() {
        beep(659.25, 0, 0.1, "triangle", 0.12);
        beep(783.99, 0.09, 0.1, "triangle", 0.12);
        beep(1046.5, 0.18, 0.2, "sine", 0.12);
      },
      wrong() {
        beep(392, 0, 0.25, "sine", 0.11, 330);
        beep(294, 0.22, 0.4, "sine", 0.1, 220);
      },
      unlock() {
        beep(784, 0, 0.14, "triangle", 0.13);
        beep(988, 0.12, 0.14, "triangle", 0.13);
        beep(1175, 0.24, 0.14, "triangle", 0.13);
        beep(1568, 0.36, 0.4, "sine", 0.12);
      },
      fanfare() {
        beep(523.25, 0, 0.16, "triangle", 0.1);
        beep(659.25, 0.14, 0.16, "triangle", 0.1);
        beep(783.99, 0.28, 0.16, "triangle", 0.1);
        beep(1046.5, 0.42, 0.45, "sine", 0.12);
      },
      warning() {
        beep(880, 0, 0.09, "square", 0.05);
        beep(880, 0.16, 0.12, "square", 0.06);
      },
      tick() {
        beep(1050, 0, 0.045, "square", 0.035);
      },
      timeUp() {
        beep(523, 0, 0.22, "triangle", 0.13);
        beep(392, 0.2, 0.3, "triangle", 0.12);
        beep(262, 0.45, 0.55, "sine", 0.12, 180);
      }
    }),
    [beep]
  );
}
