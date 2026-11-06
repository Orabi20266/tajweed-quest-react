import { useCallback, useEffect, useRef, useState } from "react";
import { levelsData } from "./data/levels.js";
import { recitationsData } from "./data/recitations.js";
import { useProgress } from "./hooks/useProgress.js";
import { useSound } from "./hooks/useSound.js";
import { useSpeech } from "./hooks/useSpeech.js";
import {
  PASS_PERCENT,
  SECONDS_PER_QUESTION,
  getMotivation,
  isLevelUnlocked,
  percentOf,
  prepareQuestions,
  starsFor,
  totalStars
} from "./lib/game.js";
import Toast from "./components/Toast.jsx";
import Modal from "./components/Modal.jsx";
import HomeScreen from "./screens/HomeScreen.jsx";
import QuizScreen from "./screens/QuizScreen.jsx";
import ResultScreen from "./screens/ResultScreen.jsx";
import ReciteScreen from "./screens/ReciteScreen.jsx";

export default function App() {
  const {
    progress,
    saveState,
    recordResult,
    recordRecitation,
    saveSession,
    clearSession,
    setSound,
    resetAll
  } = useProgress();

  const sound = useSound(progress.sound);
  const speech = useSpeech();

  const [screen, setScreen] = useState("home"); // home | quiz | result | recite
  const [reciteIndex, setReciteIndex] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [result, setResult] = useState(null);
  const [paused, setPaused] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const warnedRef = useRef(false);
  const finishingRef = useRef(false);
  const hiddenRef = useRef(false);
  const toastIdRef = useRef(0);

  const showToast = useCallback((message, duration = 3200) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, message, duration });
  }, []);

  const hideToast = useCallback(() => setToast(null), []);

  /* ---------- بدء مرحلة أو استئنافها ---------- */

  const startLevel = useCallback(
    (levelIndex) => {
      const level = levelsData[levelIndex];
      if (!level) return;

      if (!isLevelUnlocked(levelIndex, progress.best)) {
        showToast("🔒 أكمل المرحلة السابقة أولاً لفتح هذه المرحلة");
        return;
      }

      const questions = prepareQuestions(level);
      const timeLimit = questions.length * SECONDS_PER_QUESTION;

      setAttempt({
        runId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        levelIndex,
        questions,
        index: 0,
        score: 0,
        combo: 0,
        answers: [],
        timeLimit,
        timeLeft: timeLimit,
        startedAt: Date.now()
      });

      setResult(null);
      setPaused(false);
      setExitOpen(false);
      warnedRef.current = false;
      finishingRef.current = false;
      speech.cancel();
      sound.click();
      setScreen("quiz");
    },
    [progress.best, showToast, speech, sound]
  );

  const resumeSession = useCallback(() => {
    if (!progress.session) return;
    const session = progress.session;
    if (!levelsData[session.levelIndex]) {
      clearSession();
      showToast("تعذّر استئناف المحاولة السابقة، ابدأ مرحلة جديدة");
      return;
    }

    setAttempt({ ...session });
    setResult(null);
    setPaused(false);
    setExitOpen(false);
    finishingRef.current = false;
    warnedRef.current = session.timeLeft <= 60;
    setScreen("quiz");
    sound.click();
  }, [progress.session, clearSession, showToast, sound]);

  const discardSession = useCallback(() => {
    clearSession();
    showToast("تم حذف المحاولة السابقة، اختر مرحلة جديدة 🌱");
  }, [clearSession, showToast]);

  /* ---------- مرحلة التلاوة الاختيارية ---------- */

  const openRecitation = useCallback(() => {
    setReciteIndex(null);
    setAttempt(null);
    setResult(null);
    setScreen("recite");
    speech.cancel();
    sound.click();
  }, [speech, sound]);

  const selectRecitation = useCallback(
    (index) => {
      if (index === null || index === undefined) {
        setReciteIndex(null);
      } else {
        const safeIndex = Math.max(
          0,
          Math.min(recitationsData.length - 1, index)
        );
        setReciteIndex(safeIndex);
      }
      setScreen("recite");
      speech.cancel();
      sound.click();
    },
    [speech, sound]
  );

  const exitRecitation = useCallback(() => {
    setReciteIndex(null);
    setScreen("home");
    speech.cancel();
  }, [speech]);

  /* ---------- الإجابة والانتقال ---------- */

  const answerQuestion = useCallback((optionIndex) => {
    setAttempt((current) => {
      if (!current) return current;

      const alreadyAnswered = current.answers.some(
        (answer) => answer.questionIndex === current.index
      );
      if (alreadyAnswered) return current;

      const question = current.questions[current.index];
      if (!question) return current;

      const isCorrect = optionIndex === question.answer;
      const entry = {
        questionIndex: current.index,
        question: question.q,
        chosenIndex: optionIndex,
        chosen: question.options[optionIndex],
        correctText: question.options[question.answer],
        explanation: question.explanation,
        correct: isCorrect
      };

      return {
        ...current,
        score: current.score + (isCorrect ? 1 : 0),
        combo: isCorrect ? current.combo + 1 : 0,
        answers: [...current.answers, entry]
      };
    });
  }, []);

  function finishLevel(timedOut) {
    if (!attempt || finishingRef.current) return;
    finishingRef.current = true;

    const level = levelsData[attempt.levelIndex];
    const total = attempt.questions.length;
    const percent = percentOf(attempt.score, total);
    const stars = starsFor(percent);
    const passed = percent >= PASS_PERCENT;
    const elapsed = timedOut ? attempt.timeLimit : Math.max(0, attempt.timeLimit - attempt.timeLeft);
    const average = total > 0 ? Math.round(elapsed / total) : 0;
    const previousBest = progress.best[attempt.levelIndex] ?? 0;
    const previousFastest = progress.fastest[attempt.levelIndex];
    const isRecord =
      passed && elapsed > 0 && (!previousFastest || elapsed < previousFastest);
    const isFast =
      passed && percent >= 90 && elapsed <= attempt.timeLimit * 0.6;

    recordResult({
      levelIndex: attempt.levelIndex,
      percent,
      elapsed,
      passed
    });
    clearSession();
    speech.cancel();

    let emoji = "🌱";
    let title = "لا بأس، حاول مرة أخرى!";
    if (timedOut && passed) {
      emoji = "🎉";
      title = "انتهى الوقت، لكنك اجتزت المرحلة!";
    } else if (timedOut) {
      emoji = "⌛";
      title = "انتهى الوقت!";
    } else if (passed && percent === 100) {
      emoji = "🏆";
      title = "علامة كاملة! أنت بطل التجويد!";
    } else if (passed) {
      emoji = "🎉";
      title = "أحسنت! لقد اجتزت المرحلة!";
    }

    const isLast = attempt.levelIndex === levelsData.length - 1;
    let message;
    if (timedOut && passed) {
      message = `انتهى وقت المرحلة، لكنك حققت نسبة الاجتياز! حصلت على ${attempt.score} من ${total} (${percent}%). المرحلة التالية مفتوحة، ويمكنك تحسين نتيجتك وسرعتك ⚡`;
    } else if (timedOut) {
      message = `انتهى وقت المرحلة. حصلت على ${attempt.score} من ${total} (${percent}%). لكل سؤال دقيقة واحدة، راجع الشرح وأعد المحاولة وستنجح 💪`;
    } else if (passed && isLast) {
      message =
        "مبارك! لقد أتممت جميع مراحل رحلة الإتقان في أحكام التجويد. أنت الآن بطل التجويد 🏅";
    } else if (passed && percent > previousBest) {
      message = `حصلت على ${attempt.score} من ${total}، وفتحت المرحلة التالية! استمر في التقدم 🚀`;
    } else if (passed) {
      message = `حصلت على ${attempt.score} من ${total}. المرحلة التالية مفتوحة، ويمكنك تحسين نتيجتك متى شئت ⭐`;
    } else {
      message = `حصلت على ${attempt.score} من ${total} (${percent}%). تحتاج إلى ${PASS_PERCENT}% أو أكثر لفتح المرحلة التالية. راجع الشرح وأعد المحاولة، أنت تستطيع! 💪`;
    }

    setResult({
      levelIndex: attempt.levelIndex,
      levelTitle: level.title,
      score: attempt.score,
      total,
      percent,
      stars,
      passed,
      timedOut,
      elapsed,
      timeLeft: timedOut ? 0 : attempt.timeLeft,
      average,
      isFast,
      isRecord,
      hadPreviousFastest: Boolean(previousFastest),
      previousBest,
      emoji,
      title,
      message,
      motivation: getMotivation({ percent, isFast, isRecord, timedOut, passed }),
      answers: attempt.answers
    });

    setAttempt(null);
    setPaused(false);
    setExitOpen(false);
    setScreen("result");

    if (timedOut) {
      sound.timeUp();
    } else if (passed) {
      sound.unlock();
      window.setTimeout(() => sound.fanfare(), 350);
    } else {
      sound.wrong();
    }
  }

  const goNext = useCallback(() => {
    if (!attempt) return;

    if (attempt.index + 1 >= attempt.questions.length) {
      finishLevel(false);
      return;
    }

    sound.click();
    setAttempt((current) =>
      current ? { ...current, index: current.index + 1 } : current
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, sound]);

  /* ---------- الخروج والعودة ---------- */

  const requestExit = useCallback(() => setExitOpen(true), []);

  const exitQuiz = useCallback(() => {
    setExitOpen(false);
    setPaused(false);
    setAttempt(null);
    setScreen("home");
    showToast("💾 تم حفظ تقدمك، يمكنك متابعة المرحلة لاحقاً");
  }, [showToast]);

  const goHome = useCallback(() => {
    setResult(null);
    setAttempt(null);
    setReciteIndex(null);
    setScreen("home");
  }, []);

  const toggleSound = useCallback(() => {
    const next = !progress.sound;
    setSound(next);
    if (next) window.setTimeout(() => sound.click(), 0);
  }, [progress.sound, setSound, sound]);

  const confirmReset = useCallback(() => {
    resetAll();
    setResetOpen(false);
    setAttempt(null);
    setResult(null);
    setReciteIndex(null);
    setScreen("home");
    showToast("تم مسح التقدم، بداية جديدة موفقة 🌱");
  }, [resetAll, showToast]);

  /* ---------- المؤقت ---------- */

  useEffect(() => {
    if (screen !== "quiz" || !attempt || paused || exitOpen) return undefined;

    const interval = setInterval(() => {
      setAttempt((current) => {
        if (!current || current.timeLeft <= 0) return current;
        return { ...current, timeLeft: Math.max(0, current.timeLeft - 1) };
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, paused, exitOpen, attempt?.levelIndex, attempt?.questions?.length]);

  useEffect(() => {
    if (screen === "quiz" && attempt && attempt.timeLeft <= 0) {
      finishLevel(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.timeLeft, screen]);

  useEffect(() => {
    if (screen !== "quiz" || !attempt || paused) return;

    const { timeLeft, timeLimit } = attempt;

    if (
      timeLeft <= 60 &&
      timeLeft > 0 &&
      timeLeft < timeLimit &&
      !warnedRef.current
    ) {
      warnedRef.current = true;
      sound.warning();
      showToast("⏳ تبقّت دقيقة واحدة لهذه المرحلة، ركّز! (كل سؤال = دقيقة)");
    }

    if (timeLeft <= 5 && timeLeft > 0) {
      sound.tick();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.timeLeft, screen, paused]);

  /* ---------- الاستئناف بعد ترك النافذة ---------- */

  useEffect(() => {
    if (screen !== "quiz") return undefined;

    const onVisibilityChange = () => {
      if (document.hidden) {
        hiddenRef.current = true;
        setPaused(true);
      } else if (hiddenRef.current) {
        hiddenRef.current = false;
        setPaused(false);
        showToast("تم استئناف المؤقت ⏱");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [screen, showToast]);

  /* ---------- حفظ الجلسة تلقائياً ---------- */

  useEffect(() => {
    if (screen === "quiz" && attempt && attempt.timeLeft > 0) {
      saveSession(attempt);
    }
  }, [screen, attempt, saveSession]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [screen, attempt?.index, reciteIndex]);

  useEffect(() => () => speech.cancel(), [speech.cancel]);

  /* ---------- حسابات الرئيسية ---------- */

  const totalStarsCount = totalStars(levelsData, progress.best);
  const passedCount = levelsData.filter(
    (_, index) => (progress.best[index] ?? 0) >= PASS_PERCENT
  ).length;
  const overall = Math.round(
    levelsData.reduce((sum, _, index) => sum + (progress.best[index] ?? 0), 0) /
      levelsData.length
  );

  return (
    <div className="app-shell">
      <div className="bg-decor" aria-hidden="true">
        <span className="blob blob-1" />
        <span className="blob blob-2" />
        <span className="blob blob-3" />
        <span className="sparkle sparkle-1">✦</span>
        <span className="sparkle sparkle-2">✦</span>
        <span className="sparkle sparkle-3">✦</span>
      </div>

      {screen === "home" && (
        <HomeScreen
          levels={levelsData}
          recitations={recitationsData}
          progress={progress}
          totalStars={totalStarsCount}
          passedCount={passedCount}
          overall={overall}
          saveState={saveState}
          onStart={startLevel}
          onResume={resumeSession}
          onDiscardSession={discardSession}
          onOpenRecitation={openRecitation}
          onToggleSound={toggleSound}
          onReset={() => setResetOpen(true)}
        />
      )}

      {screen === "recite" && (
        <ReciteScreen
          recitations={recitationsData}
          progress={progress}
          selectedIndex={reciteIndex}
          onSelect={selectRecitation}
          onExit={exitRecitation}
          onRecord={recordRecitation}
          speech={speech}
          sound={sound}
        />
      )}

      {screen === "quiz" && attempt && (
        <QuizScreen
          key={attempt.runId ?? attempt.startedAt}
          level={levelsData[attempt.levelIndex]}
          attempt={attempt}
          levelsCount={levelsData.length}
          paused={paused || exitOpen}
          onAnswer={answerQuestion}
          onNext={goNext}
          onRequestExit={requestExit}
          speech={speech}
          sound={sound}
        />
      )}

      {screen === "result" && result && (
        <ResultScreen
          result={result}
          level={levelsData[result.levelIndex]}
          hasNext={result.passed && result.levelIndex + 1 < levelsData.length}
          onRetry={() => startLevel(result.levelIndex)}
          onNext={() => startLevel(result.levelIndex + 1)}
          onHome={goHome}
        />
      )}

      <Toast toast={toast} onDone={hideToast} />

      <Modal
        open={exitOpen}
        title="هل تريد الخروج من المرحلة؟"
        onClose={() => setExitOpen(false)}
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => setExitOpen(false)}>
              متابعة اللعب ▶
            </button>
            <button type="button" className="btn btn-ghost" onClick={exitQuiz}>
              الخروج وحفظ التقدم
            </button>
          </>
        }
      >
        <p>
          سيُحفظ تقدمك الحالي، ويمكنك متابعة المرحلة من حيث توقفت عند عودتك. المؤقت متوقف الآن.
        </p>
      </Modal>

      <Modal
        open={resetOpen}
        title="إعادة ضبط التقدم"
        onClose={() => setResetOpen(false)}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setResetOpen(false)}>
              إلغاء
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmReset}>
              نعم، امسح التقدم
            </button>
          </>
        }
      >
        <p>
          سيتم حذف جميع النجوم والنتائج وتقدم التلاوة والمحاولة المحفوظة على هذا
          الجهاز. لا يمكن التراجع عن هذه الخطوة.
        </p>
      </Modal>
    </div>
  );
}
