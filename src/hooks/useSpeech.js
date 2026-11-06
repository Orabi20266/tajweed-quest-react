import { useCallback, useEffect, useRef, useState } from "react";
import {
  getGeminiKey,
  getGeminiVoice,
  subscribeGemini,
  synthesizeSpeech
} from "../lib/gemini.js";

/* نطق عربي عبر Gemini TTS عند توفر المفتاح، أو محرّك النطق المدمج كاحتياط */
export function useSpeech() {
  const nativeSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  const [geminiReady, setGeminiReady] = useState(() => Boolean(getGeminiKey()));
  const supported = nativeSupported || geminiReady;

  const voicesRef = useRef([]);
  const audioRef = useRef(null);
  const tokenRef = useRef(0);

  useEffect(
    () =>
      subscribeGemini(() => {
        setGeminiReady(Boolean(getGeminiKey()));
      }),
    []
  );

  useEffect(() => {
    if (!nativeSupported) return undefined;
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      voicesRef.current = synth.getVoices();
    };
    loadVoices();
    synth.addEventListener?.("voiceschanged", loadVoices);
    return () => synth.removeEventListener?.("voiceschanged", loadVoices);
  }, [nativeSupported]);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      try {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.currentTime = 0;
      } catch {
        /* تجاهل */
      }
    }
  }, []);

  const cancel = useCallback(() => {
    tokenRef.current += 1;
    stopAudio();
    if (!nativeSupported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* تجاهل */
    }
  }, [nativeSupported, stopAudio]);

  const nativeSpeak = useCallback(
    (text, { rate = 0.9, pitch = 1, onEnd } = {}) => {
      if (!nativeSupported) {
        onEnd?.();
        return false;
      }

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "ar-SA";
        utterance.rate = rate;
        utterance.pitch = pitch;

        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          onEnd?.();
        };
        utterance.onend = finish;
        utterance.onerror = finish;

        const arabicVoice = voicesRef.current.find((voice) =>
          voice.lang?.toLowerCase().startsWith("ar")
        );
        if (arabicVoice) utterance.voice = arabicVoice;

        window.speechSynthesis.speak(utterance);
        return true;
      } catch {
        onEnd?.();
        return false;
      }
    },
    [nativeSupported]
  );

  const speak = useCallback(
    (text, { rate = 0.9, pitch = 1, voice, style, onEnd } = {}) => {
      const content = String(text ?? "").trim();
      if (!content) {
        onEnd?.();
        return false;
      }

      cancel();
      const token = tokenRef.current;

      const finish = () => {
        if (token === tokenRef.current) onEnd?.();
      };

      if (getGeminiKey()) {
        synthesizeSpeech(content, {
          voice: voice || getGeminiVoice(),
          rate,
          style
        })
          .then((url) => {
            if (token !== tokenRef.current) return;

            const audio = new Audio(url);
            audioRef.current = audio;

            const fallback = () => {
              if (audioRef.current === audio) audioRef.current = null;
              nativeSpeak(content, { rate, pitch, onEnd: finish });
            };

            audio.onended = () => {
              if (audioRef.current === audio) audioRef.current = null;
              finish();
            };
            audio.onerror = fallback;

            const playing = audio.play();
            if (playing?.catch) playing.catch(fallback);
          })
          .catch(() => {
            if (token === tokenRef.current) {
              nativeSpeak(content, { rate, pitch, onEnd: finish });
            }
          });

        return true;
      }

      return nativeSpeak(content, { rate, pitch, onEnd: finish });
    },
    [cancel, nativeSpeak]
  );

  useEffect(() => () => cancel(), [cancel]);

  return { supported, speak, cancel };
}
