import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import {
  GEMINI_VOICES,
  getGeminiKey,
  setGeminiKey,
  setGeminiVoice
} from "../lib/gemini.js";

/* إعداد مفتاح Gemini والصوت المستخدم في الشرح والتلاوة */
export default function GeminiSettings({ open, onClose, onSaved, voice }) {
  const [value, setValue] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(voice);
  const [existing, setExisting] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const saved = getGeminiKey();
    setExisting(saved);
    setValue("");
    setSelectedVoice(voice);
    setError("");
  }, [open, voice]);

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
    onSaved?.(Boolean(trimmed || existing));
    onClose?.();
  };

  const removeKey = () => {
    setGeminiKey("");
    setGeminiVoice(selectedVoice);
    onSaved?.(false);
    onClose?.();
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
          <span>صوت Gemini</span>
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

        {error && (
          <p className="gemini-error" role="alert">
            {error}
          </p>
        )}

        <div className="gemini-links">
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
