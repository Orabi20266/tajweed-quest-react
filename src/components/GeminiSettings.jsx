import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import {
  DEFAULT_CORRECTION_VOICE,
  GEMINI_VOICES,
  getCorrectionVoice,
  getGeminiKey,
  getGeminiVoice,
  setCorrectionVoice,
  setGeminiKey,
  setGeminiVoice,
  synthesizeSpeech
} from "../lib/gemini.js";

const PREVIEW_TEXT =
  "مرحباً يا بطل، أنا إيهاب. أحسنت المحاولة، وسنصحّح معاً قراءة الآية بهدوء.";

/* إعداد مفتاح Gemini وصوت التلاوة وصوت تصحيح الأخطاء */
export default function GeminiSettings({ open, onClose, onSaved, voice }) {
  const [value, setValue] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(voice);
  const [selectedCorrection, setSelectedCorrection] = useState(
    DEFAULT_CORRECTION_VOICE
  );
  const [existing, setExisting] = useState("");
  const [error, setError] = useState("");
  const [previewState, setPreviewState] = useState("idle");
  const [previewError, setPreviewError] = useState("");

  const audioRef = useRef(null);
  const previewToken = useRef(0);

  const stopPreview = () => {
    previewToken.current += 1;
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        /* تجاهل */
      }
    }
    setPreviewState("idle");
  };

  useEffect(() => {
    if (!open) {
      stopPreview();
      return;
    }
    const saved = getGeminiKey();
    setExisting(saved);
    setValue("");
    setSelectedVoice(voice || getGeminiVoice());
    setSelectedCorrection(getCorrectionVoice());
    setError("");
    setPreviewError("");
  }, [open, voice]);

  useEffect(() => () => stopPreview(), []);

  const save = () => {
    const trimmed = value.trim();

    if (trimmed && trimmed.length < 20) {
      setError("المفتاح يبدو قصيراً جداً. انسخه كاملاً من Google AI Studio.");
      return;
    }

    if (!trimmed && !existing) {
      setError("أدخل مفتاح Gemini أولاً، أو استخدم اللعبة بدون أصوات Gemini.");
      return;
    }

    if (trimmed) setGeminiKey(trimmed);
    setGeminiVoice(selectedVoice);
    setCorrectionVoice(selectedCorrection);
    onSaved?.(Boolean(trimmed || existing));
    onClose?.();
  };

  const removeKey = () => {
    stopPreview();
    setGeminiKey("");
    setGeminiVoice(selectedVoice);
    setCorrectionVoice(selectedCorrection);
    onSaved?.(false);
    onClose?.();
  };

  const previewCorrection = async () => {
    if (previewState === "loading") return;
    if (previewState === "playing") {
      stopPreview();
      return;
    }

    if (!existing && !value.trim()) {
      setPreviewError("احفظ مفتاح Gemini أولاً، ثم جرّب الصوت.");
      return;
    }

    stopPreview();
    const token = ++previewToken.current;
    setPreviewError("");
    setPreviewState("loading");

    try {
      const url = await synthesizeSpeech(PREVIEW_TEXT, {
        voice: selectedCorrection,
        rate: 0.92,
        style: "بصوت معلّم ودود وواضح"
      });

      if (token !== previewToken.current || !open) return;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null;
        if (token === previewToken.current) setPreviewState("idle");
      };
      audio.onerror = () => {
        if (token === previewToken.current) {
          setPreviewState("idle");
          setPreviewError("تعذّر تشغيل الصوت. تأكد من المفتاح واتصال الإنترنت.");
        }
      };

      setPreviewState("playing");
      const playing = audio.play();
      if (playing?.catch) {
        playing.catch(() => {
          if (token !== previewToken.current) return;
          setPreviewState("idle");
          setPreviewError("سماح المتصفح بالصوت مطلوب. اضغط زر التجربة مرة أخرى.");
        });
      }
    } catch (previewFailure) {
      if (token !== previewToken.current) return;
      setPreviewState("idle");
      setPreviewError(
        previewFailure?.status === 401 || previewFailure?.status === 403
          ? "المفتاح غير صالح. تأكد من نسخه كاملاً من Google AI Studio."
          : "تعذّر توليد الصوت الآن. تحقق من اتصال الإنترنت وحاول مجدداً."
      );
    }
  };

  return (
    <Modal
      open={open}
      title="✨ أصوات Gemini والتصحيح الذكي"
      onClose={onClose}
      actions={
        <>
          {existing && (
            <button type="button" className="btn btn-ghost danger-text" onClick={removeKey}>
              حذف المفتاح
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            حفظ الإعدادات
          </button>
        </>
      }
    >
      <div className="gemini-setup">
        <p>
          أضف مفتاح <b>Google AI Studio</b> لتستخدم أصوات{" "}
          <b>Gemini 3.1 Flash TTS</b> في الشرح ونطق الكلمات، وليستمع Gemini إلى
          تسجيل تلاوتك ويصححها حتى لو لم يتعرف المتصفح على صوتك.
        </p>

        <div className={`gemini-state ${existing ? "on" : ""}`}>
          <span aria-hidden="true">{existing ? "✅" : "🔑"}</span>
          {existing
            ? `المفتاح محفوظ على هذا الجهاز (ينتهي بـ ${existing.slice(-4)})`
            : "لا يوجد مفتاح بعد — ستعمل اللعبة بالصوت المدمج في المتصفح"}
        </div>

        <label className="gemini-field">
          <span>مفتاح Gemini API</span>
          <input
            type="password"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
            placeholder={existing ? "اتركه فارغاً للإبقاء على المفتاح الحالي" : "AIza..."}
            autoComplete="off"
            dir="ltr"
            spellCheck="false"
          />
        </label>

        <label className="gemini-field">
          <span>🎧 صوت التلاوة ونطق الكلمات</span>
          <select
            value={selectedVoice}
            onChange={(event) => setSelectedVoice(event.target.value)}
          >
            {GEMINI_VOICES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="gemini-field">
          <span>🗣️ صوت تصحيح الأخطاء وشرح إيهاب</span>
          <select
            value={selectedCorrection}
            onChange={(event) => {
              setSelectedCorrection(event.target.value);
              setPreviewError("");
            }}
          >
            {GEMINI_VOICES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="gemini-preview-row">
            <button
              type="button"
              className="btn btn-soft gemini-preview-btn"
              onClick={previewCorrection}
              disabled={previewState === "loading"}
            >
              {previewState === "loading"
                ? "أجهّز النموذج…"
                : previewState === "playing"
                  ? "⏹ إيقاف النموذج"
                  : "🔊 استمع إلى نموذج الصوت"}
            </button>
            <span className="gemini-preview-hint">
              {selectedCorrection === DEFAULT_CORRECTION_VOICE
                ? "الصوت الافتراضي: معلّم هادئ وواضح"
                : "يُستخدم في شرح الأخطاء وتصحيح التلاوة"}
            </span>
          </div>
          {previewError && (
            <p className="gemini-error" role="alert">
              {previewError}
            </p>
          )}
        </div>

        {error && (
          <p className="gemini-error" role="alert">
            {error}
          </p>
        )}

        <div className="gemini-links">
          <a
            href="https://aistudio.google.com/generate-speech?model=gemini-3.1-flash-tts-preview"
            target="_blank"
            rel="noopener noreferrer"
          >
            جرّب الأصوات في Google AI Studio ↗
          </a>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
          >
            احصل على مفتاح مجاني من Google AI Studio ↗
          </a>
          <span>
            يُحفظ المفتاح في متصفحك فقط، ويُرسل مباشرة إلى Google. لا يُضمَّن في
            كود اللعبة ولا يُرسل إلى خادمنا.
          </span>
        </div>
      </div>
    </Modal>
  );
}
