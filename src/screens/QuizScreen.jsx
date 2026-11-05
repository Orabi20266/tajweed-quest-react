import { useEffect, useMemo, useRef, useState } from "react";
import Coach from "../components/Coach.jsx";
import Confetti from "../components/Confetti.jsx";
import OptionButton from "../components/OptionButton.jsx";
import TimerPill from "../components/TimerPill.jsx";
import {
  OPTION_LETTERS,
  PRAISE_MESSAGES,
  WRONG_MESSAGES,
  pickRandom
} from "../lib/game.js";

export default function QuizScreen({
  level,
  attempt,
  levelsCount,
  paused,
  onAnswer,
  onNext,
  onRequestExit,
  speech,
  sound
}) {
  const question = attempt.questions[attempt.index];
  const total = attempt.questions.length;
  const isLast = attempt.index === total - 1;

  const answeredEntry = attempt.answers.find(
    (answer) => answer.questionIndex === attempt.index
  );

  const [selected, setSelected] = useState(answeredEntry ? answeredEntry.chosenIndex : null);
  const [revealed, setRevealed] = useState(Boolean(answeredEntry));
  const [confetti, setConfetti] = useState(0);
  const [confettiOrigin, setConfettiOrigin] = useState({ x: 50, y: 40 });
  const [questionSpeaking, setQuestionSpeaking] = useState(false);

  const speechToken = useRef(0);

  const praise = useMemo(
    () => pickRandom(PRAISE_MESSAGES),
    [attempt.levelIndex, attempt.index]
  );
  const wrongMessage = useMemo(
    () => pickRandom(WRONG_MESSAGES),
    [attempt.levelIndex, attempt.index]
  );

  /* عند الانتقال لسؤال جديد: إعادة ضبط حالة الإجابة والصوت */
  useEffect(() => {
    const entry = attempt.answers.find((answer) => answer.questionIndex === attempt.index);
    setSelected(entry ? entry.chosenIndex : null);
    setRevealed(Boolean(entry));
    setQuestionSpeaking(false);
    speechToken.current += 1;
    speech.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.index]);

  useEffect(
    () => () => {
      speechToken.current += 1;
      speech.cancel();
    },
    [speech.cancel]
  );

  /* اختصارات لوحة المفاتيح */
  useEffect(() => {
    if (!question) return undefined;

    const onKeyDown = (event) => {
      if (paused) return;
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (event.key === "Escape") {
        onRequestExit();
        return;
      }

      const number = Number(event.key);
      if (!revealed && number >= 1 && number <= question.options.length) {
        event.preventDefault();
        handleSelect(number - 1);
        return;
      }

      if (revealed && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        onNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!question) return null;

  const progress = Math.round(((attempt.index + (revealed ? 1 : 0)) / total) * 100);
  const correct = revealed && selected === question.answer;
  const showCombo = correct && attempt.combo >= 2;

  const handleSelect = (index, event) => {
    if (revealed || paused) return;

    const isCorrect = index === question.answer;
    setSelected(index);
    setRevealed(true);

    if (isCorrect) {
      sound.correct();
      const rect = event?.currentTarget?.getBoundingClientRect?.();
      if (rect) {
        setConfettiOrigin({
          x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
          y: (rect.top / window.innerHeight) * 100
        });
      } else {
        setConfettiOrigin({ x: 50, y: 40 });
      }
      setConfetti((value) => value + 1);
    } else {
      sound.wrong();
    }

    onAnswer(index);
  };

  const toggleQuestionSpeech = () => {
    if (!speech.supported) return;

    if (questionSpeaking) {
      speechToken.current += 1;
      setQuestionSpeaking(false);
      speech.cancel();
      return;
    }

    const token = ++speechToken.current;
    setQuestionSpeaking(true);

    const text =
      question.q +
      ". " +
      question.options
        .map((option, index) => `الخيار ${OPTION_LETTERS[index]}: ${option}`)
        .join(". ");

    const started = speech.speak(text, {
      rate: 0.88,
      onEnd: () => {
        if (token === speechToken.current) setQuestionSpeaking(false);
      }
    });

    if (!started) setQuestionSpeaking(false);
  };

  const optionState = (index) => {
    if (!revealed) return "idle";
    if (index === question.answer) return "correct";
    if (index === selected) return "wrong";
    return "muted";
  };

  return (
    <div className="screen quiz-screen">
      <Confetti
        trigger={confetti}
        originX={confettiOrigin.x}
        originY={confettiOrigin.y}
        count={26}
      />

      <header className="quiz-topbar">
        <button
          type="button"
          className="icon-btn exit-btn"
          onClick={onRequestExit}
          aria-label="الخروج من المرحلة"
          title="الخروج"
        >
          ✕
        </button>

        <div className="quiz-level">
          <span
            className="quiz-level-icon"
            style={{ background: `linear-gradient(135deg, ${level.c1}, ${level.c2})` }}
            aria-hidden="true"
          >
            {level.icon}
          </span>
          <div className="quiz-level-text">
            <strong>{level.title}</strong>
            <span>
              المرحلة {attempt.levelIndex + 1} من {levelsCount}
            </span>
          </div>
        </div>

        <div className="quiz-tools">
          <span className="question-chip">
            سؤال {attempt.index + 1} <span>/ {total}</span>
          </span>
          <TimerPill seconds={attempt.timeLeft} paused={paused} />
        </div>
      </header>

      <div className="quiz-progress" aria-hidden="true">
        <span
          style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${level.c1}, ${level.c2})`
          }}
        />
      </div>

      {paused && (
        <div className="paused-banner" role="status">
          ⏸ المؤقت متوقف مؤقتاً… عد إلى النافذة لمتابعة اللعب
        </div>
      )}

      <main className="quiz-card card" style={{ "--c1": level.c1, "--c2": level.c2 }}>
        <div className="question-head">
          <span className="question-number">السؤال {attempt.index + 1}</span>
          <button
            type="button"
            className={`listen-btn ${questionSpeaking ? "speaking" : ""}`}
            onClick={toggleQuestionSpeech}
            disabled={!speech.supported}
            aria-pressed={questionSpeaking}
            title={
              speech.supported
                ? "اسمع السؤال والخيارات"
                : "القراءة الصوتية غير مدعومة في هذا المتصفح"
            }
          >
            <span aria-hidden="true">{questionSpeaking ? "⏹" : "🔈"}</span>
            {questionSpeaking ? "إيقاف القراءة" : "استمع للسؤال"}
          </button>
        </div>

        <h1 className="question-text">{question.q}</h1>

        <div className="options" role="group" aria-label="خيارات الإجابة">
          {question.options.map((option, index) => (
            <OptionButton
              key={`${attempt.index}-${index}`}
              letter={OPTION_LETTERS[index]}
              text={option}
              state={optionState(index)}
              disabled={revealed}
              onClick={(event) => handleSelect(index, event)}
            />
          ))}
        </div>

        <p className="keyboard-hint">
          💡 استخدم الأرقام <kbd>1</kbd>–<kbd>{question.options.length}</kbd> للإجابة،
          و<kbd>Enter</kbd> للانتقال.
        </p>

        <div className="feedback-area" aria-live="polite">
          {revealed && correct && (
            <div className="feedback good">
              <div className="fb-head">
                <span className="fb-icon" aria-hidden="true">
                  ✅
                </span>
                <strong>{praise}</strong>
                {showCombo && <span className="combo">🔥 {attempt.combo} متتالية</span>}
              </div>
              <p className="fb-text">{question.explanation}</p>
            </div>
          )}

          {revealed && !correct && (
            <div className="feedback bad">
              <div className="fb-head">
                <span className="fb-icon" aria-hidden="true">
                  📘
                </span>
                <strong>{wrongMessage}</strong>
              </div>
              <Coach text={question.explanation} speech={speech} />
            </div>
          )}
        </div>

        <div className="quiz-actions">
          {revealed && (
            <button type="button" className="btn btn-primary next-btn" onClick={onNext}>
              {isLast ? "شاهد النتيجة 🎉" : "السؤال التالي ➜"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
