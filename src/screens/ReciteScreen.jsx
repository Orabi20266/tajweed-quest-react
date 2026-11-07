import { useMemo, useState } from "react";
import { RECITATION_MASTERED, isSpeechRecognitionSupported, starsForRecitation } from "../lib/recitation.js";
import RecitePracticeScreen from "./RecitePracticeScreen.jsx";

const BASMALAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

function toArabicNumber(value) {
  return String(value).replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

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

function SurahMushaf({ group, progress, recitations, onSelect }) {
  const records = group.items.map(
    (item) => progress.recitation?.[item.id]?.best ?? 0
  );
  const practicedCount = records.filter((value) => value > 0).length;
  const masteredCount = records.filter(
    (value) => value >= RECITATION_MASTERED
  ).length;
  const firstIndex = recitations.indexOf(group.items[0]);
  const showBasmalah = group.number !== 1;
  const accent = group.items[0] ?? {};

  return (
    <div
      className="surah-mushaf"
      style={{ "--c1": accent.c1, "--c2": accent.c2 }}
    >
      <div className="surah-mushaf-frame" dir="rtl" lang="ar">
        <span className="surah-mushaf-corner top-right" aria-hidden="true">
          ۞
        </span>
        <span className="surah-mushaf-corner top-left" aria-hidden="true">
          ۞
        </span>

        <div className="surah-mushaf-head">
          <span className="surah-mushaf-name">سورة {group.name}</span>
          <span className="surah-mushaf-meta">
            {group.items.length} {group.items.length === 1 ? "آية" : "آيات"}
          </span>
        </div>

        {showBasmalah && (
          <p className="surah-mushaf-basmalah">{BASMALAH}</p>
        )}

        <div className="surah-mushaf-text">
          {group.items.map((item, index) => {
            const record = records[index];
            const mastered = record >= RECITATION_MASTERED;
            const started = record > 0;

            return (
              <button
                type="button"
                key={item.id}
                className={`mushaf-ayah ${mastered ? "mastered" : ""} ${
                  started && !mastered ? "practiced" : ""
                }`}
                onClick={() => onSelect(recitations.indexOf(item))}
                aria-label={`سورة ${item.surah} الآية ${item.ayah}${
                  started ? ` — أفضل تلاوة ${record}%` : " — لم تُختبر بعد"
                }. اضغط لقراءتها منفصلة`}
                title={
                  started
                    ? `أفضل تلاوة ${record}% — اضغط للقراءة`
                    : "اضغط لقراءة الآية منفصلة"
                }
              >
                <span className="mushaf-ayah-text">{item.text}</span>
                <span className="mushaf-ayah-num" aria-hidden="true">
                  {toArabicNumber(item.ayah)}
                </span>
                {mastered && (
                  <span className="mushaf-ayah-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="surah-mushaf-foot">
        <button
          type="button"
          className="btn btn-primary mushaf-start-btn"
          onClick={() => onSelect(firstIndex)}
        >
          🎙️ اقرأ السورة من أولها
        </button>
        <span className="surah-mushaf-hint">
          اضغط على أي آية لقراءتها منفصلة
        </span>
        <span className="surah-mushaf-progress">
          {masteredCount} من {group.items.length} آيات متقنة ·{" "}
          {practicedCount} تدربت عليها
        </span>
      </div>
    </div>
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
  sound,
  hasGemini = false,
  onOpenGemini
}) {
  const selected =
    selectedIndex !== null && selectedIndex !== undefined
      ? recitations[selectedIndex]
      : null;

  const [surahFilter, setSurahFilter] = useState("all");
  const [viewMode, setViewMode] = useState("surah");

  const surahGroups = useMemo(() => {
    const map = new Map();

    recitations.forEach((item) => {
      const key = item.surahId ?? item.surah;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: item.surah,
          number: item.surahNumber,
          items: []
        });
      }
      map.get(key).items.push(item);
    });

    return [...map.values()];
  }, [recitations]);

  const visibleGroups =
    surahFilter === "all"
      ? surahGroups
      : surahGroups.filter((group) => group.id === surahFilter);

  if (selected) {
    const selectedGroup = surahGroups.find(
      (group) => group.id === (selected.surahId ?? selected.surah)
    );
    const indexInGroup = selectedGroup
      ? selectedGroup.items.indexOf(selected)
      : selectedIndex;

    return (
      <RecitePracticeScreen
        key={selected.id}
        ayah={selected}
        best={progress.recitation?.[selected.id]?.best ?? 0}
        position={indexInGroup + 1}
        total={selectedGroup ? selectedGroup.items.length : recitations.length}
        hasNext={selectedIndex + 1 < recitations.length}
        onNext={() => onSelect(selectedIndex + 1)}
        onBack={() => onSelect(null)}
        onRecord={onRecord}
        speech={speech}
        sound={sound}
        hasGemini={hasGemini}
        onOpenGemini={onOpenGemini}
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
            <strong>قسم التلاوة والتصحيح</strong>
            <span>قسم مستقل · {surahGroups.length} سور كاملة · {recitations.length} آية</span>
          </div>
        </div>

        <div className="recite-top-tools">
          <button
            type="button"
            className={`chip gemini-chip ${hasGemini ? "on" : ""}`}
            onClick={onOpenGemini}
            title="إعداد أصوات Gemini والتصحيح الذكي"
          >
            <span aria-hidden="true">✨</span>
            {hasGemini ? "Gemini مفعّل" : "أصوات Gemini"}
          </button>
          <span className="chip recitation-chip">🎧 تصحيح فوري</span>
        </div>
      </header>

      <section className="recite-hero card">
        <div className="recite-hero-glow" aria-hidden="true" />
        <div className="recite-hero-text">
          <span className="eyebrow">✨ قسم مستقل عن المراحل</span>
          <h1>اقرأ من حفظك، وأنا أصحّح لك</h1>
          <p>
            اختر سورة كاملة أو آية واحدة، ثم اقرأها بصوت واضح. سأسجّل صوتك
            وأستمع إليك، وأحدّد الكلمات الصحيحة والقريبة والتي تحتاج مراجعة،
            وأشرح لك حكم التجويد ببساطة. يمكنك عرض السورة كاملة معاً كالمصحف
            أو آية آية، والضغط على أي آية لقراءتها منفصلة. وإن أردت القراءة من
            حفظك فأخفِ الآية، وستظهر الكلمات التي تقرؤها أثناء التلاوة.
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

      {!supported && !hasGemini && (
        <div className="recite-support-warning" role="status">
          <span aria-hidden="true">🎧</span>
          <div>
            <p>
              متصفحك لا يدعم التعرف على الكلام. يمكنك الاستماع للآيات والتدرب
              عليها، أو تفعيل Gemini ليصحح تلاوتك من تسجيل صوتك مباشرة.
            </p>
            <button type="button" className="btn btn-soft" onClick={onOpenGemini}>
              ✨ إعداد أصوات Gemini
            </button>
          </div>
        </div>
      )}

      <section className="recite-list-section">
        <div className="section-head">
          <h2>اختر سورة كاملة أو آية للتلاوة</h2>
          <span className="section-hint">
            {RECITATION_MASTERED}% أو أكثر تعني أنك أتقنت الآية
          </span>
        </div>

        <div className="recite-surah-filter" role="tablist" aria-label="تصفية السور">
          <button
            type="button"
            role="tab"
            aria-selected={surahFilter === "all"}
            className={`recite-surah-chip ${surahFilter === "all" ? "active" : ""}`}
            onClick={() => setSurahFilter("all")}
          >
            <span>كل السور</span>
            <small>{recitations.length}</small>
          </button>

          {surahGroups.map((group) => {
            const masteredInSurah = group.items.filter(
              (item) =>
                (progress.recitation?.[item.id]?.best ?? 0) >=
                RECITATION_MASTERED
            ).length;

            return (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={surahFilter === group.id}
                className={`recite-surah-chip ${
                  surahFilter === group.id ? "active" : ""
                } ${masteredInSurah === group.items.length ? "complete" : ""}`}
                onClick={() => {
                  setSurahFilter(group.id);
                  setViewMode("surah");
                }}
              >
                <span>سورة {group.name}</span>
                <small>
                  {masteredInSurah > 0
                    ? `${masteredInSurah}/${group.items.length}`
                    : group.items.length}
                </small>
              </button>
            );
          })}
        </div>

        {visibleGroups.map((group) => {
          const focused = surahFilter !== "all";
          const showMushaf = focused && viewMode === "surah";

          return (
            <div className="recite-surah-group" key={group.id}>
              <div className="recite-surah-head">
                <h3>سورة {group.name}</h3>

                <div className="recite-surah-head-side">
                  {focused && (
                    <div
                      className="recite-view-toggle"
                      role="tablist"
                      aria-label="طريقة عرض السورة"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={viewMode === "surah"}
                        className={`recite-view-btn ${
                          viewMode === "surah" ? "active" : ""
                        }`}
                        onClick={() => setViewMode("surah")}
                      >
                        📖 السورة كاملة
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={viewMode === "ayat"}
                        className={`recite-view-btn ${
                          viewMode === "ayat" ? "active" : ""
                        }`}
                        onClick={() => setViewMode("ayat")}
                      >
                        🧩 آية آية
                      </button>
                    </div>
                  )}

                  <span className="recite-surah-count">
                    {group.items.length}{" "}
                    {group.items.length === 1 ? "آية" : "آيات"}
                  </span>
                </div>
              </div>

              {showMushaf ? (
                <SurahMushaf
                  group={group}
                  progress={progress}
                  recitations={recitations}
                  onSelect={onSelect}
                />
              ) : (
                <div className="recite-grid">
                  {group.items.map((item) => {
                    const index = recitations.indexOf(item);
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
                          <span className="recite-card-surah">
                            سورة {item.surah}
                          </span>
                          <span className="recite-card-label">{item.label}</span>
                        </span>

                        <span className="recite-card-ayah" dir="rtl" lang="ar">
                          {item.text}
                        </span>

                        <span className="recite-card-bottom">
                          <span className="recite-card-num">
                            الآية {item.ayah}
                          </span>
                          <span className="recite-card-record">
                            {record > 0
                              ? `أفضل تلاوة ${record}%`
                              : "لم تُختبر بعد"}
                          </span>
                        </span>

                        <span className="recite-card-foot">
                          <SmallStars count={stars} />
                          <span
                            className={`recite-card-cta ${
                              mastered ? "done" : ""
                            }`}
                          >
                            {mastered
                              ? "✓ متقنة · أعد التلاوة"
                              : "ابدأ التلاوة 🎙️"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <footer className="footer">
        <p>
          التلاوة المرجعية للشيخ محمود خليل الحصري عبر{" "}
          <a
            href="https://alquran.cloud/"
            target="_blank"
            rel="noopener noreferrer"
          >
            AlQuran Cloud
          </a>
          . هذا القسم اختياري ولا يؤثر على فتح مراحل التجويد.
        </p>
        <span className="save-pill local">
          🎙️ الصوت يُعالج للتصحيح فقط، ولا تُحفظ التسجيلات في اللعبة
        </span>
      </footer>
    </div>
  );
}
