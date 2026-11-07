import { useEffect, useRef, useState } from "react";
import EhabAvatar from "./EhabAvatar.jsx";
import { COACH_NAME } from "../lib/game.js";
import { useGeminiSettings } from "../hooks/useGemini.js";
import { GEMINI_VOICES } from "../lib/gemini.js";

/* فقاعة شرح إيهاب عند الإجابة الخاطئة، بصوت تصحيح مخصص */
export default function Coach({ text, speech }) {
  const { speak, cancel, supported } = speech;
  const { hasKey, correctionVoice } = useGeminiSettings();
  const [speaking, setSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const tokenRef = useRef(0);

  const voiceName =
    GEMINI_VOICES.find((voice) => voice.id === correctionVoice)?.id ??
    correctionVoice;

  useEffect(
    () => () => {
      tokenRef.current += 1;
      cancel();
    },
    [cancel]
  );

  const toggle = () => {
    if (!supported) return;

    if (speaking) {
      tokenRef.current += 1;
      setSpeaking(false);
      cancel();
      return;
    }

    const token = ++tokenRef.current;
    setSpeaking(true);
    setVoiceError("");
    const started = speak(`قال ${COACH_NAME}: ${text}`, {
      rate: 0.82,
      voice: hasKey ? correctionVoice : undefined,
      style: "بصوت معلّم ودود يشرح ببساطة وبطء",
      allowNativeFallback: !hasKey,
      onError: (failure) => {
        if (token !== tokenRef.current) return;
        setVoiceError(
          failure === "gemini-playback-blocked"
            ? "اضغط «استمع للشرح» مرة أخرى لتشغيل صوت Google AI Studio."
            : failure === "missing-key"
              ? "أضف مفتاح Gemini من زر «✨ أصوات Gemini» لسماع الشرح بصوت Google AI Studio."
              : "تعذّر تشغيل صوت Google AI Studio الآن. تحقق من الإنترنت أو المفتاح ثم أعد المحاولة."
        );
      },
      onEnd: () => {
        if (token === tokenRef.current) setSpeaking(false);
      }
    });

    if (!started) setSpeaking(false);
  };

  return (
    <div className="coach">
      <div className="coach-avatar">
        <EhabAvatar title={`${COACH_NAME} يشرح الحكم`} />
      </div>
      <div className="coach-body">
        <span className="coach-name">
          {COACH_NAME} <span aria-hidden="true">👦</span>
        </span>
        <p className="coach-text">{text}</p>
        <div className="coach-actions">
          <button
            type="button"
            className={`coach-listen ${speaking ? "speaking" : ""}`}
            onClick={toggle}
            disabled={!supported}
            aria-pressed={speaking}
            title={supported ? "اسمع الشرح بصوت عالٍ" : "القراءة الصوتية غير مدعومة في هذا المتصفح"}
          >
            <span aria-hidden="true">{speaking ? "⏹" : "🔈"}</span>
            {speaking ? "إيقاف الشرح" : "استمع للشرح"}
          </button>
          <span className={`coach-voice-badge ${hasKey ? "gemini" : ""}`}>
            {hasKey ? `✨ Google AI Studio · ${voiceName}` : "🔈 صوت المتصفح"}
          </span>
        </div>
        {voiceError && (
          <p className="coach-voice-error" role="alert">
            {voiceError}
          </p>
        )}
      </div>
    </div>
  );
}
