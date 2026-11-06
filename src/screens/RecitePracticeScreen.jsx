import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Coach from "../components/Coach.jsx";
import Confetti from "../components/Confetti.jsx";
import ProgressRing from "../components/ProgressRing.jsx";
import { useRecitation } from "../hooks/useRecitation.js";
import { evaluateRecitation, getGeminiKey } from "../lib/gemini.js";
import {
  RECITATION_MASTERED,
  alignRecitation,
  buildCorrectionText,
  buildResultFromVerdicts,
  getRecitationFeedback,
  splitWords,
  starsForRecitation
} from "../lib/recitation.js";

const ERROR_MESSAGES = {
  unsupported:
    "هذا المتصفح لا يدعم الاستماع إلى الصوت. جرّب متصفح Chrome أو Edge، أو استخدم وضع التدريب بالاستماع وترديد الآية.",
  denied:
    "لم يُسمح باستخدام الميكروفون. اضغط على أيقونة القفل في شريط العنوان، واسمح بالوصول إلى الميكروفون، ثم أعد المحاولة.",
  "service-not-allowed":
    "خدمة التعرف على الكلام غير متاحة. تأكد من السماح للميكروفون، ثم أعد المحاولة.",
  "no-mic": "لم أجد ميكروفوناً متصلاً. وصّل ميكروفوناً ثم أعد المحاولة.",
  "busy-mic":
    "الميكروفون مستخدم من تطبيق آخر. أغلق التطبيقات التي تستخدمه ثم أعد المحاولة.",
  "mic-timeout":
    "لم يصل ردّ إذن الميكروفون. اضغط على أيقونة القفل بجوار العنوان، واسمح بالوصول إلى الميكروفون، ثم أعد المحاولة.",
  "no-speech":
    "لم أسمع صوتك. تأكد من الميكروفون، واقترب منه، واقرأ الآية بصوت واضح.",
  network:
    "تعذّر الاتصال بخدمة التعرف على الكلام. تحقق من اتصال الإنترنت ثم أعد المحاولة.",
  "language-not-supported":
    "تعذّر تشغيل التعرف على اللغة العربية في هذا المتصفح. جرّب Chrome أو Edge.",
  aborted: "توقف الاستماع. يمكنك المحاولة من جديد.",
  start: "تعذّر تشغيل الميكروفون. أعد المحاولة، وتأكد من السماح بالوصول إليه.",
  unknown: "حدث خطأ غير متوقع أثناء الاستماع. أعد المحاولة من فضلك."
};

const EMPTY_SPEECH_MESSAGE =
  "لم أسمع تلاوتك بوضوح. اقترب من الميكروفون، واقرأ الآية بصوت أعلى قليلاً، ثم أعد المحاولة.";

function ReciteStars({ count }) {
  return (
    <div className="recite-stars" aria-label={`${count} من 3 نجوم`}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={index < count ? "recite-star on" : "recite-star off"}
          aria-hidden="true"
        >
          {index < count ? "⭐" : "☆"}
        </span>
      ))}
    </div>
  );
}

export default function RecitePracticeScreen({
  ayah,
  best,
  position,
  total,
  hasNext,
  onNext,
  onBack,
  onRecord,
  speech,
  sound,
  hasGemini = false,
  onOpenGemini
}) {
  const recitation = useRecitation();
  const { speak, cancel: cancelSpeech, supported: speechSupported } = speech;

  const [phase, setPhase] = useState("idle"); // idle | listening | checked
  const [result, setResult] = useState(null);
  const [referencePlaying, setReferencePlaying] = useState(false);
  const [audioBroken, setAudioBroken] = useState(false);
  const [playingWord, setPlayingWord] = useState(null);
  const [confetti, setConfetti] = useState(0);
  const [noSpeech, setNoSpeech] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);

  const audioRef = useRef(null);
  const referenceToken = useRef(0);
  const wordToken = useRef(0);
  const checkedRef = useRef(false);

  const words = useMemo(() => splitWords(ayah.text), [ayah.text]);
  const wordResults = result?.words ?? null;
  const feedback = result ? getRecitationFeedback(result) : null;
  const stars = result ? starsForRecitation(result.accuracy) : 0;
  const corrections = result
    ? result.words.filter((item) => item.status !== "correct")
    : [];
  const coachText = result ? buildCorrectionText(result, ayah.tip) : "";
  const errorText = recitation.error
    ? ERROR_MESSAGES[recitation.error] ?? ERROR_MESSAGES.unknown
    : "";
  const showingNoSpeech = noSpeech && !recitation.error;
  const verifying =
    phase === "listening" &&
    !recitation.starting &&
    recitation.hasStarted &&
    !recitation.listening;

  useEffect(() => {
    if (!recitation.audioBlob) {
      setAudioUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(recitation.audioBlob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recitation.audioBlob]);

  /* ---------- التلاوة المرجعية ---------- */

  useEffect(() => {
    const audio = new Audio(ayah.audio);
    audio.preload = "none";
    audioRef.current = audio;

    const handleEnded = () => setReferencePlaying(false);
    const handleError = () => {
      setAudioBroken(true);
      setReferencePlaying(false);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.pause();
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [ayah.audio]);

  const stopReference = useCallback(() => {
    referenceToken.current += 1;
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        /* تجاهل */
      }
    }
    cancelSpeech();
    setReferencePlaying(false);
  }, [cancelSpeech]);

  const speakReferenceTts = useCallback(() => {
    const token = ++referenceToken.current;
    setReferencePlaying(true);
    const started = speak(ayah.text, {
      rate: 0.72,
      onEnd: () => {
        if (referenceToken.current === token) setReferencePlaying(false);
      }
    });
    if (!started) setReferencePlaying(false);
  }, [ayah.text, speak]);

  const playReference = () => {
    if (referencePlaying) {
      stopReference();
      return;
    }

    if (phase === "listening") recitation.stop();
    cancelSpeech();

    const audio = audioRef.current;
    if (!audioBroken && audio) {
      const token = ++referenceToken.current;
      setReferencePlaying(true);

      const fallback = () => {
        if (referenceToken.current !== token) return;
        setAudioBroken(true);
        speakReferenceTts();
      };

      try {
        const promise = audio.play();
        if (promise && typeof promise.catch === "function") {
          promise.catch(fallback);
        }
        return;
      } catch {
        fallback();
        return;
      }
    }

    speakReferenceTts();
  };

  const speakWord = (word) => {
    if (!speechSupported || phase === "listening") return;
    stopReference();
    const token = ++wordToken.current;
    setPlayingWord(word);
    const started = speak(word, {
      rate: 0.62,
      onEnd: () => {
        if (wordToken.current === token) setPlayingWord(null);
      }
    });
    if (!started) setPlayingWord(null);
  };

  /* ---------- الاستماع والتحقق ---------- */

  const finalize = useCallback(async () => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    setPlayingWord(null);
    setAnalyzing(true);
    setAiNote("");

    try {
      const blob = await recitation.getAudio();
      const fallbackTranscript = recitation.getTranscript();
      let analysis = null;
      let source = "browser";

      if (blob && getGeminiKey()) {
        try {
          const evaluation = await evaluateRecitation({
            audio: blob,
            ayahText: ayah.text,
            words
          });
          const spoken = evaluation?.transcript || fallbackTranscript;

          if (evaluation?.verdicts) {
            analysis = buildResultFromVerdicts(
              ayah.text,
              evaluation.verdicts,
              spoken
            );
          } else if (spoken) {
            analysis = alignRecitation(ayah.text, spoken);
          }

          if (analysis) source = "gemini";
          if (evaluation?.note) setAiNote(evaluation.note);
        } catch (error) {
          const invalidKey = error?.status === 401 || error?.status === 403;
          setAiNote(
            invalidKey
              ? "مفتاح Gemini غير صالح. افتح «أصوات Gemini» وأدخل مفتاحاً صحيحاً، ثم أعد المحاولة."
              : "تعذّر استخدام Gemini الآن، فاستخدمت التعرف المدمج في المتصفح. أعد المحاولة بعد قليل للحصول على تدقيق أدق."
          );
        }
      }

      if (!analysis) {
        analysis = alignRecitation(ayah.text, fallbackTranscript);
      }
      analysis.source = source;

      if (!analysis.transcript) {
        setNoSpeech(true);
        setPhase("idle");
        sound.warning();
        return;
      }

      setResult(analysis);
      setPhase("checked");

      if (analysis.accuracy >= 95) {
        sound.fanfare();
        setConfetti((value) => value + 1);
      } else if (analysis.accuracy >= RECITATION_MASTERED) {
        sound.correct();
        setConfetti((value) => value + 1);
      } else {
        sound.wrong();
      }

      if (analysis.accuracy > 0) {
        onRecord({ id: ayah.id, percent: analysis.accuracy });
      }
    } finally {
      setAnalyzing(false);
    }
  }, [
    ayah.id,
    ayah.text,
    onRecord,
    recitation.getAudio,
    recitation.getTranscript,
    sound,
    words
  ]);

  useEffect(() => {
    if (phase !== "listening") return undefined;
    if (recitation.starting || recitation.listening) return undefined;

    if (!recitation.hasStarted) {
      if (recitation.error) setPhase("idle");
      return undefined;
    }

    const timer = window.setTimeout(() => finalize(), 500);
    return () => window.clearTimeout(timer);
  }, [
    phase,
    recitation.starting,
    recitation.listening,
    recitation.hasStarted,
    recitation.error,
    finalize
  ]);

  const startListening = () => {
    if (!recitation.supported) return;

    stopReference();
    cancelSpeech();
    setResult(null);
    setPlayingWord(null);
    setNoSpeech(false);
    setAiNote("");
    setAnalyzing(false);
    checkedRef.current = false;
    setPhase("listening");
    sound.click();

    recitation
      .start()
      .then((started) => {
        if (!started) setPhase("idle");
      })
      .catch(() => setPhase("idle"));
  };

  const stopListening = () => {
    const wasStarting = recitation.starting;
    recitation.stop();
    if (wasStarting) setPhase("idle");
    sound.click();
  };

  const retry = () => {
    stopReference();
    recitation.reset();
    setResult(null);
    setPlayingWord(null);
    setNoSpeech(false);
    setAiNote("");
    setAnalyzing(false);
    setConfetti(0);
    checkedRef.current = false;
    setPhase("idle");
    sound.click();
  };

  const goBack = () => {
    stopReference();
    recitation.reset();
    onBack();
  };

  const goNext = () => {
    if (!hasNext) return;
    stopReference();
    recitation.reset();
    onNext();
  };

  useEffect(
    () => () => {
      cancelSpeech();
      if (audioRef.current) audioRef.current.pause();
    },
    [cancelSpeech]
  );

  const bestShown = Math.max(best ?? 0, result?.accuracy ?? 0);

  return (
    <div className="screen recite-screen recite-practice">
      <Confetti trigger={confetti} originX={50} originY={34} count={40} />

      <header className="quiz-topbar recite-topbar">
        <button
          type="button"
          className="icon-btn exit-btn"
          onClick={goBack}
          aria-label="العودة إلى قائمة الآيات"
          title="العودة"
        >
          ✕
        </button>

        <div className="quiz-level">
          <span
            className="quiz-level-icon"
            style={{ background: `linear-gradient(135deg, ${ayah.c1}, ${ayah.c2})` }}
            aria-hidden="true"
          >
            🎙️
          </span>
          <div className="quiz-level-text">
            <strong>سورة {ayah.surah}</strong>
            <span>
              الآية {ayah.ayah} · {position} من {total}
            </span>
          </div>
        </div>

        <div className="recite-top-tools">
          <span className={`chip ${bestShown >= RECITATION_MASTERED ? "mastered" : ""}`}>
            <span aria-hidden="true">⭐</span>
            {bestShown > 0 ? `أفضل ${bestShown}%` : "تلاوة جديدة"}
          </span>
          <button
            type="button"
            className={`chip gemini-chip ${hasGemini ? "on" : ""}`}
            onClick={onOpenGemini}
            title="إعداد أصوات Gemini والتصحيح الذكي"
          >
            <span aria-hidden="true">✨</span>
            {hasGemini ? "Gemini مفعّل" : "أصوات Gemini"}
          </button>
          <span className="chip recitation-chip">اختياري</span>
        </div>
      </header>

      <main
        className="recite-panel card"
        style={{ "--c1": ayah.c1, "--c2": ayah.c2 }}
      >
        <div className="recite-head">
          <div>
            <span className="recite-eyebrow">🎙️ اقرأ بصوتك</span>
            <h1>
              سورة {ayah.surah} — الآية {ayah.ayah}
            </h1>
            <p>{ayah.label} · التلاوة المرجعية للشيخ مشاري العفاسي</p>
          </div>

          <button
            type="button"
            className={`listen-btn ${referencePlaying ? "speaking" : ""}`}
            onClick={playReference}
            aria-pressed={referencePlaying}
            title="استمع إلى التلاوة الصحيحة"
          >
            <span aria-hidden="true">{referencePlaying ? "⏹" : "🔈"}</span>
            {referencePlaying ? "إيقاف التلاوة" : "استمع للآية"}
          </button>
        </div>

        {audioBroken && (
          <p className="recite-note">
            تعذّر تشغيل التلاوة المرجعية، وسيُستخدم النطق الآلي بدلاً منها.
          </p>
        )}

        <p className="recite-instruction">
          اضغط على أي كلمة لسماع نطقها، ثم اقرأ الآية كاملة بصوت واضح. سيسجّل
          التطبيق صوتك، ويستخدم Gemini لتدقيق التلاوة عند تفعيله، ويتوقف
          الاستماع تلقائياً عند سكوتك.
        </p>

        <div className="ayah-frame">
          <span className="ayah-corner top-right" aria-hidden="true">
            ۞
          </span>
          <span className="ayah-corner top-left" aria-hidden="true">
            ۞
          </span>

          <div className="ayah-words" dir="rtl" lang="ar">
            {words.map((word, index) => {
              const status = wordResults?.[index]?.status;
              return (
                <button
                  type="button"
                  key={`${word}-${index}`}
                  className={[
                    "ayah-word",
                    status ? `word-${status}` : "",
                    playingWord === word ? "word-speaking" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => speakWord(word)}
                  disabled={!speechSupported || phase === "listening"}
                  title={
                    speechSupported
                      ? "اضغط لسماع نطق الكلمة"
                      : "النطق الصوتي غير مدعوم في هذا المتصفح"
                  }
                >
                  {word}
                </button>
              );
            })}
            <span className="ayah-end-mark" aria-hidden="true">
              ۝
            </span>
          </div>

          <div className="ayah-caption">
            <span>
              سورة {ayah.surah} · الآية {ayah.ayah}
            </span>
            <span className="ayah-ordinal" aria-hidden="true">
              ۝ {ayah.ayah}
            </span>
          </div>
        </div>

        <div className="recite-status-row" aria-live="polite">
          {phase === "listening" && recitation.starting && (
            <span className="recite-verifying">
              <span className="verifying-dot" aria-hidden="true" />
              أجهّز الميكروفون… اسمح بالوصول عند ظهور الطلب
            </span>
          )}

          {analyzing && (
            <span className="recite-verifying">
              <span className="verifying-dot" aria-hidden="true" />
              🤖 أستمع إلى تسجيلك وأدقّق التلاوة…
            </span>
          )}

          {verifying && !analyzing && (
            <span className="recite-verifying">
              <span className="verifying-dot" aria-hidden="true" />
              أتحقق من تلاوتك…
            </span>
          )}

          {phase === "listening" && recitation.listening && (
            <span className="recite-listening">
              <span className="listening-dot" aria-hidden="true" />
              {recitation.recording
                ? "🔴 أسجّل صوتك… اقرأ بتؤدة ووضوح"
                : "أسمعك الآن… اقرأ بتؤدة ووضوح"}
            </span>
          )}

          {phase === "idle" && recitation.supported && !recitation.starting && (
            <span className="recite-ready">
              🎧 الميكروفون جاهز عندما تضغط «ابدأ التلاوة»
              {hasGemini ? " · Gemini سيصحح من تسجيلك" : ""}
            </span>
          )}
        </div>

        {!recitation.supported && (
          <div className="recite-fallback">
            <strong>🎧 وضع التدريب بدون ميكروفون</strong>
            <p>
              متصفحك لا يدعم التعرف على الكلام. يمكنك الاستماع للآية والضغط على
              الكلمات لسماع نطقها، أو تفعيل Gemini ليقوم بالتصحيح من تسجيل صوتك
              مباشرة.
            </p>
            <button type="button" className="btn btn-soft" onClick={onOpenGemini}>
              ✨ إعداد أصوات Gemini
            </button>
          </div>
        )}

        {(recitation.error || noSpeech) && !result && (
          <div className="recite-error" role="alert">
            <span className="recite-error-icon" aria-hidden="true">
              {showingNoSpeech ? "🎙️" : "⚠️"}
            </span>
            <div>
              <strong>
                {showingNoSpeech ? "لم أسمع تلاوتك" : "تعذّر الاستماع"}
              </strong>
              <p>
                {showingNoSpeech
                  ? EMPTY_SPEECH_MESSAGE
                  : errorText || EMPTY_SPEECH_MESSAGE}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                recitation.reset();
                setNoSpeech(false);
                setPhase("idle");
              }}
            >
              حسناً
            </button>
          </div>
        )}

        <div className={`transcript-box ${phase === "listening" ? "live" : ""}`}>
          <div className="transcript-head">
            <span>📝 ما سمعه إيهاب</span>
            {result?.source === "gemini" ? (
              <span className="ai-badge">🤖 Gemini</span>
            ) : (
              phase === "listening" && (
                <span className="live-label">
                  <span className="live-dot" aria-hidden="true" />
                  مباشر
                </span>
              )
            )}
          </div>

          {result?.transcript ? (
            <p className="transcript-final">{result.transcript}</p>
          ) : recitation.finalText ? (
            <p className="transcript-final">{recitation.finalText}</p>
          ) : (
            <p className="transcript-placeholder">
              {analyzing
                ? "أستمع إلى تسجيلك وأدقّق الكلمات…"
                : phase === "listening"
                  ? "ابدأ القراءة بصوت واضح…"
                  : "لم تُسجّل تلاوة بعد. اضغط «ابدأ التلاوة» عندما تكون جاهزاً."}
            </p>
          )}

          {phase === "listening" && recitation.interim && (
            <p className="transcript-interim">{recitation.interim}</p>
          )}

          {aiNote && <p className="recite-ai-note">🤖 {aiNote}</p>}

          {audioUrl && phase !== "listening" && (
            <div className="recite-recording">
              <span>🎧 استمع إلى تسجيلك</span>
              <audio controls src={audioUrl} preload="metadata" />
            </div>
          )}
        </div>

        {result && feedback && (
          <section className={`recite-result ${feedback.tone}`} aria-live="polite">
            <div className="recite-result-top">
              <span className="recite-result-emoji" aria-hidden="true">
                {feedback.emoji}
              </span>
              <div>
                <h2>{feedback.title}</h2>
                <p>{feedback.message}</p>
              </div>
            </div>

            <div className="recite-score-row">
              <ProgressRing
                percent={result.accuracy}
                passed={result.accuracy >= RECITATION_MASTERED}
                label="دقة التلاوة"
              />

              <div className="recite-score-side">
                <ReciteStars count={stars} />
                <div className="recite-counts">
                  <span className="recite-count good">✅ {result.exactCount}</span>
                  <span className="recite-count close">🟡 {result.closeCount}</span>
                  <span className="recite-count missing">
                    ⚠️ {result.missingCount}
                  </span>
                </div>
                {result.source === "gemini" && (
                  <span className="recite-ai-badge">
                    🤖 دقّق Gemini تسجيلك كلمة بكلمة
                  </span>
                )}
                <p className="recite-best-note">
                  أفضل نتيجة لك في هذه الآية: <b>{bestShown}%</b>
                </p>
              </div>
            </div>

            <Coach text={coachText} speech={speech} />

            {corrections.length > 0 && (
              <div className="recite-corrections">
                <h3>🔍 كلمات تحتاج مراجعة</h3>
                <div className="correction-list">
                  {corrections.map((item, index) => (
                    <button
                      type="button"
                      key={`${item.word}-${index}`}
                      className={`correction-item ${item.status}`}
                      onClick={() => speakWord(item.word)}
                      disabled={!speechSupported}
                      title="اسمع النطق الصحيح"
                    >
                      <span className="correction-status">
                        {item.status === "close" ? "🟡 قريبة" : "⚠️ لم تُسمع"}
                      </span>
                      <span className="correction-expected">{item.word}</span>
                      <span className="correction-heard">
                        {item.heard ? `سمعت: ${item.heard}` : "أعد نطقها بوضوح"}
                      </span>
                      <span className="correction-play" aria-hidden="true">
                        {playingWord === item.word ? "🔊" : "🔈"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {corrections.length === 0 && result.transcript && (
              <p className="recite-perfect">
                🎯 لا أخطاء! نطقت كل كلمة بوضوح، واصل على هذا النهج.
              </p>
            )}

            <div className="recite-tip">
              <span aria-hidden="true">💡</span>
              <p>
                <strong>تذكّر حكم التجويد:</strong> {ayah.tip}
              </p>
            </div>
          </section>
        )}

        <div className="recite-controls">
          {phase === "idle" && recitation.supported && (
            <button type="button" className="btn btn-primary mic-start" onClick={startListening}>
              🎙️ ابدأ التلاوة
            </button>
          )}

          {phase === "listening" && (
            <button
              type="button"
              className="btn btn-danger mic-stop"
              onClick={stopListening}
              disabled={verifying || analyzing}
            >
              {analyzing
                ? "أدقّق التلاوة…"
                : verifying
                  ? "جارٍ التحقق…"
                  : "⏹ أوقف وتحقق"}
            </button>
          )}

          {phase !== "listening" && (
            <button
              type="button"
              className={`btn btn-soft ${referencePlaying ? "playing" : ""}`}
              onClick={playReference}
            >
              <span aria-hidden="true">{referencePlaying ? "⏹" : "🔈"}</span>
              {referencePlaying ? "إيقاف التلاوة" : "استمع للآية"}
            </button>
          )}

          {phase === "checked" && (
            <>
              <button type="button" className="btn btn-primary" onClick={retry}>
                أعد المحاولة ↺
              </button>
              {hasNext && (
                <button type="button" className="btn btn-soft" onClick={goNext}>
                  الآية التالية ➜
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={goBack}>
                قائمة الآيات
              </button>
            </>
          )}
        </div>

        <p className="recite-privacy">
          🔒 لا تُحفظ تسجيلاتك في اللعبة. عند تفعيل Gemini يُرسل التسجيل مباشرة
          إلى Google لتدقيق التلاوة، ولا يُرسل إلى خادمنا. وبدون المفتاح يستخدم
          المتصفح التعرف الصوتي المدمج فقط.
        </p>
      </main>
    </div>
  );
}
