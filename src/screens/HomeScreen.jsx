import EhabAvatar from "../components/EhabAvatar.jsx";
import {
  PASS_PERCENT,
  formatTime,
  isLevelUnlocked,
  starsFor
} from "../lib/game.js";

function Stars({ count }) {
  return (
    <span className="stars" aria-label={`${count} من 3 نجوم`}>
      {[0, 1, 2].map((index) => (
        <span key={index} className={index < count ? "star on" : "star off"} aria-hidden="true">
          ⭐
        </span>
      ))}
    </span>
  );
}

function LevelCard({ level, index, best, fastest, locked, onStart }) {
  const stars = starsFor(best);
  const passed = best >= PASS_PERCENT;

  return (
    <button
      type="button"
      className={`level-card ${locked ? "locked" : "unlocked"} ${passed ? "passed" : ""}`}
      style={{ "--c1": level.c1, "--c2": level.c2 }}
      onClick={() => onStart(index)}
      disabled={locked}
      aria-label={`${level.title}${locked ? " — مقفلة" : ""}`}
    >
      <span className="level-strip" aria-hidden="true" />
      <span className="level-top">
        <span className="level-icon" aria-hidden="true">
          {level.icon}
        </span>
        {locked ? (
          <span className="lock-chip" aria-hidden="true">
            🔒
          </span>
        ) : (
          <Stars count={stars} />
        )}
      </span>

      <span className="level-title">{level.title}</span>
      <span className="level-desc">{level.desc}</span>

      <span className="level-meta">
        {locked
          ? "أكمل المرحلة السابقة لفتحها"
          : passed
            ? `✓ مكتملة · أفضل نتيجة ${best}%`
            : best > 0
              ? `أفضل نتيجة ${best}%`
              : "ابدأ المرحلة الآن"}
      </span>

      <span className="level-bar" aria-hidden="true">
        <span style={{ width: `${best}%` }} />
      </span>

      <span className="level-footer">
        <span>{level.questions.length} أسئلة</span>
        {fastest ? (
          <span className="level-fast">⚡ {formatTime(fastest)}</span>
        ) : (
          <span className="level-fast muted">⏱ {level.questions.length} د</span>
        )}
      </span>
    </button>
  );
}

export default function HomeScreen({
  levels,
  progress,
  totalStars,
  passedCount,
  overall,
  saveState,
  onStart,
  onResume,
  onDiscardSession,
  onToggleSound,
  onReset
}) {
  const session = progress.session;
  const sessionLevel = session ? levels[session.levelIndex] : null;
  const canResume = Boolean(session && sessionLevel);

  return (
    <div className="screen home-screen">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">
            🦉
          </span>
          <div className="brand-text">
            <h1>رحلة الإتقان</h1>
            <p>أحكام التجويد للأبطال</p>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="chip stars-chip" title="مجموع النجوم">
            <span aria-hidden="true">⭐</span>
            <b>{totalStars}</b>
            <span className="chip-total">/ {levels.length * 3}</span>
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleSound}
            aria-label={progress.sound ? "إيقاف الصوت" : "تشغيل الصوت"}
            title={progress.sound ? "إيقاف الصوت" : "تشغيل الصوت"}
          >
            {progress.sound ? "🔊" : "🔇"}
          </button>
          <button
            type="button"
            className="icon-btn danger"
            onClick={onReset}
            aria-label="إعادة ضبط التقدم"
            title="إعادة ضبط التقدم"
          >
            ↺
          </button>
        </div>
      </header>

      <section className="hero card">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-text">
          <span className="eyebrow">🌟 رحلة تعليمية ممتعة</span>
          <h2>
            تعلّم أحكام التجويد مع <span className="accent">إيهاب</span>
          </h2>
          <p>
            عشر مراحل متدرّجة، و103 أسئلة، ومؤقّت ممتع. أجب، تعلّم من الشرح، واجمع النجوم
            حتى تصبح بطل التجويد!
          </p>

          <div className="hero-stats">
            <div className="stat">
              <b>
                {passedCount}
                <small>/{levels.length}</small>
              </b>
              <span>مراحل مكتملة</span>
            </div>
            <div className="stat">
              <b>{totalStars}</b>
              <span>نجوم</span>
            </div>
            <div className="stat">
              <b>{overall}%</b>
              <span>تقدّمك</span>
            </div>
          </div>

          <div className="overall-progress" aria-label={`التقدم الكلي ${overall}%`}>
            <span style={{ width: `${overall}%` }} />
          </div>
        </div>

        <div className="hero-mascot">
          <div className="hero-bubble">
            <strong>أهلاً بك! 👋</strong>
            <span>أنا إيهاب، سأشرح لك كل حكم تتعلّمه.</span>
          </div>
          <EhabAvatar className="hero-avatar" title="إيهاب مرحباً بك" />
        </div>
      </section>

      {canResume && (
        <section className="resume-card" aria-label="متابعة المحاولة">
          <div className="resume-icon" aria-hidden="true">
            ⏯
          </div>
          <div className="resume-body">
            <strong>لديك محاولة لم تكتمل</strong>
            <p>
              {sessionLevel.icon} {sessionLevel.title} — السؤال {session.index + 1} من{" "}
              {sessionLevel.questions.length} · متبقٍ {formatTime(session.timeLeft)}
            </p>
            <div className="resume-progress" aria-hidden="true">
              <span
                style={{
                  width: `${Math.round(
                    ((session.index + 1) / sessionLevel.questions.length) * 100
                  )}%`
                }}
              />
            </div>
          </div>
          <div className="resume-actions">
            <button type="button" className="btn btn-primary" onClick={onResume}>
              متابعة ▶
            </button>
            <button type="button" className="btn btn-ghost" onClick={onDiscardSession}>
              بدء من جديد
            </button>
          </div>
        </section>
      )}

      <section className="levels-section">
        <div className="section-head">
          <h2>خريطة المراحل</h2>
          <span className="section-hint">
            اجمع {PASS_PERCENT}% أو أكثر لفتح المرحلة التالية
          </span>
        </div>

        <div className="levels-grid">
          {levels.map((level, index) => (
            <LevelCard
              key={level.id ?? index}
              level={level}
              index={index}
              best={progress.best[index] ?? 0}
              fastest={progress.fastest[index]}
              locked={!isLevelUnlocked(index, progress.best)}
              onStart={onStart}
            />
          ))}
        </div>
      </section>

      <footer className="footer">
        <p>
          الأسئلة مستوحاة من منهج{" "}
          <a href="https://surahquran.com/Tajweed/" target="_blank" rel="noopener noreferrer">
            أحكام التجويد في موقع سورة قرآن
          </a>
          .
        </p>
        <span className={`save-pill ${saveState}`}>
          {saveState === "linked"
            ? "💾 تقدمك محفوظ ومرتبط بجهازك، لن تبدأ من جديد"
            : "💾 يُحفظ تقدمك تلقائياً على هذا الجهاز"}
        </span>
      </footer>
    </div>
  );
}
