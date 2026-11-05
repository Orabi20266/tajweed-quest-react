import { useEffect, useRef, useState } from "react";
import EhabAvatar from "./EhabAvatar.jsx";
import { COACH_NAME } from "../lib/game.js";

/* فقاعة شرح إيهاب عند الإجابة الخاطئة */
export default function Coach({ text, speech }) {
  const { speak, cancel, supported } = speech;
  const [speaking, setSpeaking] = useState(false);
  const tokenRef = useRef(0);

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
    const started = speak(`قال ${COACH_NAME}: ${text}`, {
      rate: 0.82,
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
      </div>
    </div>
  );
}
