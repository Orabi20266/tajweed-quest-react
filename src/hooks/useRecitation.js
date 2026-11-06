import { useCallback, useEffect, useRef, useState } from "react";

function getRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * يستمع إلى تلاوة الطالب عبر التعرف على الكلام المدمج في المتصفح.
 * يجمع النتائج النهائية والمؤقتة، ويتوقف تلقائياً بعد فترة سكوت،
 * ويعيد رموز الأخطاء لتترجمها الواجهة إلى رسائل مفهومة.
 */
export function useRecitation({ lang = "ar-SA", autoStopMs = 7000 } = {}) {
  const [supported] = useState(() => Boolean(getRecognitionCtor()));
  const [listening, setListening] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const silenceRef = useRef(null);
  const mountedRef = useRef(true);

  const clearSilence = useCallback(() => {
    if (silenceRef.current) {
      window.clearTimeout(silenceRef.current);
      silenceRef.current = null;
    }
  }, []);

  const armSilence = useCallback(() => {
    clearSilence();
    if (!autoStopMs) return;

    silenceRef.current = window.setTimeout(() => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      try {
        recognition.stop();
      } catch {
        /* تجاهل */
      }
    }, autoStopMs);
  }, [autoStopMs, clearSilence]);

  const start = useCallback(() => {
    const Recognition = getRecognitionCtor();
    if (!Recognition) {
      setError("unsupported");
      return false;
    }

    const previous = recognitionRef.current;
    if (previous) {
      try {
        previous.abort();
      } catch {
        /* تجاهل */
      }
      recognitionRef.current = null;
    }

    clearSilence();
    finalRef.current = "";
    interimRef.current = "";
    setFinalText("");
    setInterim("");
    setError(null);
    setHasStarted(false);

    let recognition;
    try {
      recognition = new Recognition();
    } catch {
      setError("start");
      return false;
    }

    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (!mountedRef.current) return;
      setListening(true);
      setHasStarted(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      if (!mountedRef.current) return;

      let finals = finalRef.current;
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? "";
        if (!transcript) continue;

        if (result.isFinal) {
          finals = `${finals} ${transcript}`.replace(/\s+/g, " ").trim();
        } else {
          interimText = `${interimText} ${transcript}`.replace(/\s+/g, " ").trim();
        }
      }

      finalRef.current = finals;
      interimRef.current = interimText;
      setFinalText(finals);
      setInterim(interimText);
      armSilence();
    };

    recognition.onerror = (event) => {
      if (!mountedRef.current) return;
      const code = event?.error;
      if (code === "aborted") return;

      const normalized =
        code === "not-allowed"
          ? "denied"
          : code === "audio-capture"
            ? "no-mic"
            : code;

      setError(normalized || "unknown");
      setListening(false);
    };

    recognition.onend = () => {
      clearSilence();
      if (!mountedRef.current) return;
      setListening(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
      return true;
    } catch {
      recognitionRef.current = null;
      setError("start");
      setListening(false);
      return false;
    }
  }, [armSilence, clearSilence, lang]);

  const stop = useCallback(() => {
    clearSilence();
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        /* تجاهل */
      }
    }
    setListening(false);
  }, [clearSilence]);

  const reset = useCallback(() => {
    clearSilence();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        /* تجاهل */
      }
    }

    finalRef.current = "";
    interimRef.current = "";
    setFinalText("");
    setInterim("");
    setListening(false);
    setHasStarted(false);
    setError(null);
  }, [clearSilence]);

  const getTranscript = useCallback(
    () =>
      `${finalRef.current} ${interimRef.current}`
        .replace(/\s+/g, " ")
        .trim(),
    []
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSilence();
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        try {
          recognition.abort();
        } catch {
          /* تجاهل */
        }
      }
    };
  }, [clearSilence]);

  return {
    supported,
    listening,
    hasStarted,
    finalText,
    interim,
    transcript: `${finalText} ${interim}`.replace(/\s+/g, " ").trim(),
    error,
    start,
    stop,
    reset,
    getTranscript
  };
}
