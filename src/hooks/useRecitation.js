import { useCallback, useEffect, useRef, useState } from "react";
import { getGeminiKey, subscribeGemini } from "../lib/gemini.js";

function getRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function getMediaRecorderSupport() {
  if (typeof window === "undefined") return false;
  return (
    typeof window.MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

function pickRecorderMime() {
  if (typeof window === "undefined" || !window.MediaRecorder) return "";
  const candidates = [
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm"
  ];
  return (
    candidates.find((type) => window.MediaRecorder.isTypeSupported?.(type)) ?? ""
  );
}

function mapMicError(error) {
  const name = error?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no-mic";
  if (name === "NotReadableError" || name === "AbortError") return "busy-mic";
  if (name === "TimeoutError") return "mic-timeout";
  return "start";
}

/**
 * يستمع إلى تلاوة الطالب عبر الميكروفون ويسجّلها، مع التعرف على الكلام
 * كخيار احتياطي. يسجّل الصوت ليرسله Gemini للتقييم عند توفر المفتاح،
 * ويكتشف السكوت تلقائياً حتى لا يعلق الاستماع.
 */
export function useRecitation({ lang = "ar-SA", autoStopMs = 7000, maxMs = 60000 } = {}) {
  const [recognitionSupported] = useState(() => Boolean(getRecognitionCtor()));
  const [mediaSupported] = useState(getMediaRecorderSupport);
  const [hasGemini, setHasGemini] = useState(() => Boolean(getGeminiKey()));
  const [starting, setStarting] = useState(false);
  const [listening, setListening] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recording, setRecording] = useState(false);

  const supported = recognitionSupported || (mediaSupported && hasGemini);

  const mountedRef = useRef(true);
  const activeRef = useRef(false);
  const manualStopRef = useRef(false);
  const sessionRef = useRef(0);

  const recognitionRef = useRef(null);
  const recognitionAttemptsRef = useRef(0);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const recognitionRetryRef = useRef(null);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const blobRef = useRef(null);
  const stopResolveRef = useRef(null);
  const stopPromiseRef = useRef(null);

  const silenceRef = useRef(null);
  const maxRef = useRef(null);
  const monitorRef = useRef(null);
  const audioCtxRef = useRef(null);
  const monitorActiveRef = useRef(false);
  const startedAtRef = useRef(0);
  const lastVoiceRef = useRef(0);
  const spokeRef = useRef(false);
  const stopRef = useRef(null);

  const clearTimer = (ref) => {
    if (ref.current) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const clearFallbackSilence = useCallback(() => {
    clearTimer(silenceRef);
  }, []);

  const armFallbackSilence = useCallback(() => {
    if (monitorActiveRef.current || !autoStopMs) return;
    clearFallbackSilence();
    silenceRef.current = window.setTimeout(() => {
      if (activeRef.current) stopRef.current?.();
    }, autoStopMs);
  }, [autoStopMs, clearFallbackSilence]);

  const abortRecognition = useCallback(() => {
    if (recognitionRetryRef.current) {
      window.clearTimeout(recognitionRetryRef.current);
      recognitionRetryRef.current = null;
    }
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        /* تجاهل */
      }
    }
  }, []);

  const closeAudioMonitor = useCallback(() => {
    monitorActiveRef.current = false;
    if (monitorRef.current) {
      cancelAnimationFrame(monitorRef.current);
      monitorRef.current = null;
    }
    const context = audioCtxRef.current;
    audioCtxRef.current = null;
    if (context) {
      try {
        context.close();
      } catch {
        /* تجاهل */
      }
    }
  }, []);

  const releaseStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* تجاهل */
        }
      });
    }
  }, []);

  /* ---------- تسجيل الصوت ---------- */

  const startRecorder = useCallback((stream) => {
    if (!window.MediaRecorder) return;

    try {
      const mimeType = pickRecorderMime();
      const recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 })
        : new window.MediaRecorder(stream);

      chunksRef.current = [];
      blobRef.current = null;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const type =
          recorder.mimeType || chunksRef.current[0]?.type || "audio/webm";
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type })
            : null;

        blobRef.current = blob;
        if (mountedRef.current) {
          setAudioBlob(blob);
          setRecording(false);
        }

        const resolve = stopResolveRef.current;
        stopResolveRef.current = null;
        resolve?.(blob);
      };

      recorder.start(250);
      recorderRef.current = recorder;
      if (mountedRef.current) setRecording(true);
    } catch {
      recorderRef.current = null;
      if (mountedRef.current) setRecording(false);
    }
  }, []);

  /* ---------- كشف السكوت عبر شدة الصوت ---------- */

  const startVoiceMonitor = useCallback(
    (stream) => {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      try {
        const context = new AudioCtx();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);

        audioCtxRef.current = context;
        monitorActiveRef.current = true;
        startedAtRef.current = Date.now();
        lastVoiceRef.current = Date.now();
        spokeRef.current = false;

        const buffer = new Uint8Array(analyser.fftSize);
        const maxSilence = Math.max(3500, autoStopMs);
        const maxWait = Math.max(9000, maxSilence * 1.6);

        const tick = () => {
          if (!activeRef.current) return;

          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let index = 0; index < buffer.length; index += 1) {
            const value = (buffer[index] - 128) / 128;
            sum += value * value;
          }
          const rms = Math.sqrt(sum / buffer.length);
          const now = Date.now();

          if (rms > 0.035) {
            spokeRef.current = true;
            lastVoiceRef.current = now;
          } else if (
            spokeRef.current &&
            now - lastVoiceRef.current > maxSilence
          ) {
            stopRef.current?.();
            return;
          } else if (!spokeRef.current && now - startedAtRef.current > maxWait) {
            stopRef.current?.();
            return;
          }

          monitorRef.current = requestAnimationFrame(tick);
        };

        monitorRef.current = requestAnimationFrame(tick);
      } catch {
        monitorActiveRef.current = false;
      }
    },
    [autoStopMs]
  );

  /* ---------- التعرف على الكلام ---------- */

  const startRecognition = useCallback(() => {
    const Recognition = getRecognitionCtor();
    if (!Recognition || !activeRef.current) return;

    const previous = recognitionRef.current;
    if (previous) {
      try {
        previous.abort();
      } catch {
        /* تجاهل */
      }
      recognitionRef.current = null;
    }

    let recognition;
    try {
      recognition = new Recognition();
    } catch {
      return;
    }

    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (!mountedRef.current || !activeRef.current) return;
      setError(null);
    };

    recognition.onresult = (event) => {
      if (!mountedRef.current || !activeRef.current) return;

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
      armFallbackSilence();
    };

    recognition.onerror = (event) => {
      const code = event?.error;
      if (code === "aborted") return;
      if (!activeRef.current) return;

      if (code === "no-speech") {
        /* لا نغلق الجلسة: نعيد تشغيل التعرف ونكمل التسجيل */
        return;
      }

      const canFallback = mediaSupported && Boolean(getGeminiKey());

      if (code === "network" && canFallback) return;
      if (code === "audio-capture" && canFallback) return;
      if (
        (code === "not-allowed" || code === "service-not-allowed") &&
        canFallback
      ) {
        return;
      }

      const normalized =
        code === "not-allowed" ? "denied" : code === "audio-capture" ? "no-mic" : code;

      if (!mountedRef.current) return;
      setError(normalized || "unknown");
      stopRef.current?.();
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (!activeRef.current || manualStopRef.current) return;

      if (recognitionAttemptsRef.current >= 14) return;
      recognitionAttemptsRef.current += 1;

      if (!recognitionRetryRef.current) {
        recognitionRetryRef.current = window.setTimeout(() => {
          recognitionRetryRef.current = null;
          if (activeRef.current && !recognitionRef.current) startRecognition();
        }, 320);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      recognitionRef.current = null;
    }
  }, [armFallbackSilence, lang, mediaSupported]);

  /* ---------- بدء الاستماع ---------- */

  const resetInternal = useCallback(() => {
    sessionRef.current += 1;
    activeRef.current = false;
    manualStopRef.current = false;

    clearTimer(silenceRef);
    clearTimer(maxRef);
    abortRecognition();
    closeAudioMonitor();

    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.onstop = null;
        recorder.stop();
      } catch {
        /* تجاهل */
      }
    }

    releaseStream();
    stopResolveRef.current = null;
    stopPromiseRef.current = null;
  }, [abortRecognition, closeAudioMonitor, releaseStream]);

  const reset = useCallback(() => {
    resetInternal();
    finalRef.current = "";
    interimRef.current = "";
    chunksRef.current = [];
    blobRef.current = null;

    if (!mountedRef.current) return;
    setStarting(false);
    setListening(false);
    setHasStarted(false);
    setFinalText("");
    setInterim("");
    setError(null);
    setAudioBlob(null);
    setRecording(false);
  }, [resetInternal]);

  const start = useCallback(async () => {
    if (!supported) {
      setError("unsupported");
      return false;
    }

    resetInternal();
    const session = sessionRef.current;

    finalRef.current = "";
    interimRef.current = "";
    chunksRef.current = [];
    blobRef.current = null;
    recognitionAttemptsRef.current = 0;

    setStarting(true);
    setListening(false);
    setHasStarted(false);
    setFinalText("");
    setInterim("");
    setError(null);
    setAudioBlob(null);
    setRecording(false);

    let stream = null;

    if (mediaSupported) {
      const request = navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });

      let timeoutId;
      const timeout = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          const error = new Error("mic-timeout");
          error.name = "TimeoutError";
          reject(error);
        }, 20000);
      });

      try {
        stream = await Promise.race([request, timeout]);
      } catch (micError) {
        /* إذا وصل إذن الميكروفون بعد انتهاء المهلة نحرّر الجهاز */
        if (micError?.name === "TimeoutError") {
          request
            .then((late) => late?.getTracks?.().forEach((track) => track.stop()))
            .catch(() => {});
        }
        if (session !== sessionRef.current || !mountedRef.current) return false;
        setStarting(false);
        setError(mapMicError(micError));
        return false;
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    if (session !== sessionRef.current || !mountedRef.current) {
      stream?.getTracks().forEach((track) => track.stop());
      return false;
    }

    streamRef.current = stream;
    activeRef.current = true;
    manualStopRef.current = false;
    recognitionAttemptsRef.current = 0;

    setStarting(false);
    setHasStarted(true);
    setListening(true);

    if (stream) {
      startRecorder(stream);
      startVoiceMonitor(stream);
    }

    if (recognitionSupported) startRecognition();

    maxRef.current = window.setTimeout(() => {
      if (activeRef.current) stopRef.current?.();
    }, maxMs);

    return true;
  }, [
    maxMs,
    mediaSupported,
    recognitionSupported,
    resetInternal,
    startRecognition,
    startRecorder,
    startVoiceMonitor,
    supported
  ]);

  /* ---------- إيقاف الاستماع ---------- */

  const stop = useCallback(() => {
    /* يُبطل أي طلب ميكروفون لم يكتمل بعد */
    sessionRef.current += 1;

    if (!activeRef.current && !recorderRef.current) {
      if (mountedRef.current) {
        setStarting(false);
        setListening(false);
        setRecording(false);
      }
      return Promise.resolve(blobRef.current);
    }

    activeRef.current = false;
    manualStopRef.current = true;

    clearTimer(silenceRef);
    clearTimer(maxRef);
    abortRecognition();
    closeAudioMonitor();

    if (mountedRef.current) {
      setStarting(false);
      setListening(false);
      setRecording(false);
    }

    const recorder = recorderRef.current;

    const promise = new Promise((resolve) => {
      if (!recorder || recorder.state === "inactive") {
        resolve(blobRef.current);
        return;
      }

      let settled = false;
      const finish = (blob) => {
        if (settled) return;
        settled = true;
        if (stopResolveRef.current === finish) stopResolveRef.current = null;
        resolve(blob ?? blobRef.current);
      };

      stopResolveRef.current = finish;
      recorder.addEventListener("stop", () => finish(blobRef.current), {
        once: true
      });

      try {
        recorder.stop();
      } catch {
        finish(blobRef.current);
      }

      window.setTimeout(() => finish(blobRef.current), 1800);
    });

    stopPromiseRef.current = promise;

    /* نحرّر الميكروفون بعد أن ينهي المسجّل آخر قطعة */
    window.setTimeout(releaseStream, 350);

    return promise;
  }, [abortRecognition, closeAudioMonitor, releaseStream]);

  stopRef.current = stop;

  const getAudio = useCallback(
    () => stopPromiseRef.current ?? Promise.resolve(blobRef.current),
    []
  );

  const getTranscript = useCallback(
    () =>
      `${finalRef.current} ${interimRef.current}`
        .replace(/\s+/g, " ")
        .trim(),
    []
  );

  /* ---------- دورة الحياة ---------- */

  useEffect(() => {
    const unsubscribe = subscribeGemini(() => {
      if (mountedRef.current) setHasGemini(Boolean(getGeminiKey()));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      resetInternal();
    };
  }, [resetInternal]);

  return {
    supported,
    recognitionSupported,
    mediaSupported,
    starting,
    listening,
    hasStarted,
    finalText,
    interim,
    transcript: `${finalText} ${interim}`.replace(/\s+/g, " ").trim(),
    error,
    audioBlob,
    recording,
    start,
    stop,
    reset,
    getTranscript,
    getAudio
  };
}
