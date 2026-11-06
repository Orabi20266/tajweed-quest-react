import { RECITATION_MASTERED, isSpeechRecognitionSupported, starsForRecitation } from "../lib/recitation.js";
import RecitePracticeScreen from "./RecitePracticeScreen.jsx";

function SmallStars({ count }) {
  return (
    <span className="recite-card-stars" aria-label={`${count} من 3 نجوم`}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={index < count ? "recite-card-star on" : "recite-card-star off"}
          aria-hidden="true"
        >
          {index < count ? "⭐" : "☆"}
        </span>
      ))}
    </span>
  );
}

export default function ReciteScreen({
  recitations,
  progress,
  selectedIndex,
  onSelect,
  onExit,
  onRecord,
  speech,
  sound
}) {
  const selected =
    selectedIndex !== null && selectedIndex !== undefined
      ? recitations[selectedIndex]
      : null;

  if (selected) {
    return (
      <RecitePracticeScreen
        key={selected.id}
        ayah={selected}
        best={progress.recitation?.[selected.id]?.best ?? 0}
        position={selectedIndex + 1}
        total={recitations.length}
        hasNext={selectedIndex + 1 < recitations.length}
        onNext={() => onSelect(selectedIndex + 1)}
        onBack={() => onSelect(null)}
        onRecord={onRecord}
        speech={speech}
        sound={sound}
      />
    );
  }

  const records = recitations.map(
    (item) => progress.recitation?.[item.id]?.best ?? 0
  );
  const best = records.length > 0 ? Math.max(...records) : 0;
  const practicedCount = records.filter((value) => value > 0).length;
  const masteredCount = records.filter(
    (value) => value >= RECITATION_MASTERED
  ).length;
  const supported = isSpeechRecognitionSupported();

  return (
    <div className="screen recite-screen">
      <header className="quiz-topbar recite-topbar">
        <button
          type="button"
          className="icon-btn exit-btn"
          onClick={onExit}
          aria-label="العودة إلى الصفحة الرئيسية"
          title="العودة للرئيسية"
        >
          ✕
        </button>

        <div className="quiz-level">
          <span className="quiz-level-icon recite-level-icon" aria-hidden="true">
            🎙️
          </span>
          <div className="quiz-level-text">
            <strong>مرحلة التلاوة</strong>
            <span>مرحلة اختيارية · {recitations.length} آيات قصيرة</span>
          </div>
        </div>

        <span className="chip recitation-chip">🎧 تصحيح فوري</span>
      </header>

      <section className="recite-hero card">
        <div className="recite-hero-glow" aria-hidden="true" />
        <div className="recite-hero-text">
          <span className="eyebrow">✨ مرحلة اختيارية جديدة</span>
          <h1>اقرأ الآية بصوتك، وأنا أصحّح لك</h1>
          <p>
            اختر آية قصيرة، ثم اقرأها بصوت واضح. سأستمع إليك، وأحدّد الكلمات
            الصحيحة والقريبة والتي تحتاج مراجعة، وأشرح لك حكم التجويد ببساطة.
          </p>

          <div className="recite-hero-stats">
            <div className="recite-hero-stat">
              <b>
                {practicedCount}
                <small>/{recitations.length}</small>
              </b>
              <span>آيات تدربت عليها</span>
            </div>
            <div className="recite-hero-stat">
              <b>{masteredCount}</b>
              <span>آيات متقنة</span>
            </div>
            <div className="recite-hero-stat">
              <b>{best}%</b>
              <span>أفضل تلاوة</span>
            </div>
          </div>
        </div>

        <div className="recite-hero-side">
          <div className="recite-mic-orb" aria-hidden="true">
            🎙️
          </div>
          <ul className="recite-steps">
            <li>
              <span>1</span> اسمح للميكروفون
            </li>
            <li>
              <span>2</span> اقرأ الآية بتؤدة
            </li>
            <li>
              <span>3</span> استمع لتصحيح إيهاب
            </li>
          </ul>
        </div>
      </section>

      {!supported && (
        <div className="recite-support-warning" role="status">
          <span aria-hidden="true">🎧</span>
          <p>
            متصفحك لا يدعم الاستماع إلى الكلام. يمكنك الاستماع للآيات والتدرب
            عليها، وللحصول على تصحيح تلقائي استخدم متصفح Chrome أو Edge.
          </p>
        </div>
      )}

      <section className="recite-list-section">
        <div className="section-head">
          <h2>اختر آية للتلاوة</h2>
          <span className="section-hint">
            {RECITATION_MASTERED}% أو أكثر تعني أنك أتقنت الآية
          </span>
        </div>

        <div className="recite-grid">
          {recitations.map((item, index) => {
            const record = progress.recitation?.[item.id]?.best ?? 0;
            const stars = starsForRecitation(record);
            const mastered = record >= RECITATION_MASTERED;

            return (
              <button
                type="button"
                key={item.id}
                className={`recite-card ${mastered ? "mastered" : ""}`}
                style={{ "--c1": item.c1, "--c2": item.c2 }}
                onClick={() => onSelect(index)}
                aria-label={`سورة ${item.surah} الآية ${item.ayah}${
                  mastered ? " — متقنة" : ""
                }`}
              >
                <span className="recite-card-strip" aria-hidden="true" />

                <span className="recite-card-top">
                  <span className="recite-card-surah">سورة {item.surah}</span>
                  <span className="recite-card-label">{item.label}</span>
                </span>

                <span className="recite-card-ayah" dir="rtl" lang="ar">
                  {item.text}
                </span>

                <span className="recite-card-bottom">
                  <span className="recite-card-num">الآية {item.ayah}</span>
                  <span className="recite-card-record">
                    {record > 0 ? `أفضل تلاوة ${record}%` : "لم تُختبر بعد"}
                  </span>
                </span>

                <span className="recite-card-foot">
                  <SmallStars count={stars} />
                  <span className={`recite-card-cta ${mastered ? "done" : ""}`}>
                    {mastered ? "✓ متقنة · أعد التلاوة" : "ابدأ التلاوة 🎙️"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="footer">
        <p>
          التلاوة المرجعية للشيخ مشاري العفاسي عبر{" "}
          <a
            href="https://alquran.cloud/"
            target="_blank"
            rel="noopener noreferrer"
          >
            AlQuran Cloud
          </a>
          . هذه المرحلة اختيارية ولا تؤثر على فتح مراحل التجويد.
        </p>
        <span className="save-pill local">
          🎙️ صوتك يُعالَج للتعرف على الكلام فقط، ولا يُحفظ في اللعبة
        </span>
      </footer>
    </div>
  );
}
