import { useCallback, useEffect, useRef } from "react";

/* نطق عربي باستخدام محرّك النطق المدمج في المتصفح */
export function useSpeech() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const voicesRef = useRef([]);

  useEffect(() => {
    if (!supported) return undefined;
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      voicesRef.current = synth.getVoices();
    };
    loadVoices();
    synth.addEventListener?.("voiceschanged", loadVoices);
    return () => synth.removeEventListener?.("voiceschanged", loadVoices);
  }, [supported]);

  const cancel = useCallback(() => {
    if (!supported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* تجاهل */
    }
  }, [supported]);

  const speak = useCallback(
    (text, { rate = 0.9, pitch = 1, onEnd } = {}) => {
      if (!supported) {
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
    [supported]
  );

  return { supported, speak, cancel };
}
