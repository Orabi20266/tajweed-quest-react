import Confetti from "../components/Confetti.jsx";
import ProgressRing from "../components/ProgressRing.jsx";
import EhabAvatar from "../components/EhabAvatar.jsx";
import { formatTime } from "../lib/game.js";

function ResultStars({ count }) {
  return (
    <div className="result-stars" aria-label={`${count} من 3 نجوم`}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={index < count ? "result-star on" : "result-star off"}
          style={{ animationDelay: `${0.15 * index}s` }}
          aria-hidden="true"
        >
          {index < count ? "⭐" : "☆"}
        </span>
      ))}
    </div>
  );
}

export default function ResultScreen({ result, level, hasNext, onRetry, onNext, onHome }) {
  const mistakes = result.answers.filter((answer) => !answer.correct);
  const showRecordBadge = result.isRecord && !result.isFast && result.hadPreviousFastest;

  return (
    <div className="screen result-screen">
      <Confetti
        trigger={result.passed ? 1 : 0}
        originX={50}
        originY={26}
        count={result.passed ? 48 : 0}
      />

      <div className="result-level-chip">
        <span
          className="result-level-icon"
          style={{ background: `linear-gradient(135deg, ${level.c1}, ${level.c2})` }}
          aria-hidden="true"
        >
          {level.icon}
        </span>
        <span>{level.title}</span>
      </div>

      <section className="result-card card">
        <div className="result-glow" aria-hidden="true" />
        <div className="result-emoji" aria-hidden="true">
          {result.emoji}
        </div>
        <h1 className="result-title">{result.title}</h1>

        <ProgressRing percent={result.percent} passed={result.passed} label="نتيجتك" />

        <ResultStars count={result.stars} />

        {result.isFast && <div className="speed-badge">⚡ وقت قياسي</div>}
        {showRecordBadge && <div className="speed-badge record">🏁 أسرع من محاولتك السابقة</div>}

        <div className="result-stats">
          <span className="stat-chip">
            ✅ {result.score} / {result.total}
          </span>
          <span className="stat-chip">⏱ {formatTime(result.elapsed)}</span>
          <span className="stat-chip">📊 {result.average} ثانية / سؤال</span>
          {result.timedOut ? (
            <span className="stat-chip danger">⌛ انتهى الوقت</span>
          ) : (
            <span className="stat-chip">⏳ متبقٍ {formatTime(result.timeLeft)}</span>
          )}
        </div>

        <div className="motivation">
          <span className="motivation-avatar" aria-hidden="true">
            <EhabAvatar title="إيهاب يشجعك" />
          </span>
          <p>{result.motivation}</p>
        </div>

        <p className="result-message">{result.message}</p>

        <div className="result-actions">
          {result.passed && hasNext && (
            <button type="button" className="btn btn-primary" onClick={onNext}>
              المرحلة التالية ⬅
            </button>
          )}
          <button
            type="button"
            className={`btn ${result.passed && hasNext ? "btn-soft" : "btn-primary"}`}
            onClick={onRetry}
          >
            أعد المحاولة ↺
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            🗺 خريطة المراحل
          </button>
        </div>
      </section>

      <section className="review-card card">
        <details open={!result.passed}>
          <summary>
            <span>📘 مراجعة الأخطاء</span>
            <span className={`review-count ${mistakes.length === 0 ? "clean" : ""}`}>
              {mistakes.length === 0
                ? "لا أخطاء 🎯"
                : mistakes.length === 1
                  ? "سؤال واحد"
                  : `${mistakes.length} أسئلة`}
            </span>
          </summary>

          {mistakes.length === 0 ? (
            <p className="perfect-note">
              أداء مثالي! لم تُخطئ في أي سؤال. واصل على هذا النهج يا بطل 🌟
            </p>
          ) : (
            <div className="review-list">
              {mistakes.map((answer, index) => (
                <article className="review-item" key={`${answer.questionIndex}-${index}`}>
                  <p className="review-question">{answer.question}</p>
                  <div className="review-answers">
                    <span className="review-wrong">
                      <span aria-hidden="true">✕</span> {answer.chosen}
                    </span>
                    <span className="review-correct">
                      <span aria-hidden="true">✓</span> {answer.correctText}
                    </span>
                  </div>
                  <div className="review-explanation">
                    <span className="review-bulb" aria-hidden="true">
                      💡
                    </span>
                    <p>{answer.explanation}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </details>
      </section>

      <footer className="result-footer">
        <span aria-hidden="true">🦉</span>
        <span>الأسئلة مستوحاة من منهج أحكام التجويد في موقع سورة قرآن</span>
      </footer>
    </div>
  );
}
