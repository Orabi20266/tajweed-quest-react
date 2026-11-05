/* =========================================================
   أدوات اللعبة المشتركة: خلط الأسئلة، النسب، الوقت، التخزين
   ========================================================= */

export const PASS_PERCENT = 70;
export const SECONDS_PER_QUESTION = 60;
export const STORAGE_KEY = "tajweed_react_v1";
export const IP_STORAGE_PREFIX = "tajweed_react_ip_";
/* مفاتيح النسخة القديمة (HTML) لترحيل التقدم تلقائياً */
export const LEGACY_STORAGE_KEY = "tajweed_quest_v1";
export const LEGACY_IP_STORAGE_PREFIX = "tajweed_quest_ip_";
export const COACH_NAME = "إيهاب";
export const OPTION_LETTERS = ["أ", "ب", "ج", "د", "هـ", "و"];

export const PRAISE_MESSAGES = [
  "أحسنت! 🌟",
  "رائع جداً! 🎉",
  "مبدع يا بطل! 👏",
  "إجابة صحيحة! 💚",
  "ما شاء الله! ✨",
  "أنت نجم التجويد! ⭐"
];

export const WRONG_MESSAGES = [
  "لا بأس، تعلّم من الشرح 💪",
  "قريب جداً! حاول في السؤال القادم 🌱",
  "لا تقلق، الخطأ بداية التعلّم 🌈",
  "ركّز قليلاً في الحكم التالي 🧐"
];

export function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* يخلط الخيارات ويحافظ على الإجابة الصحيحة، ويخلط ترتيب الأسئلة */
export function prepareQuestions(level) {
  return shuffle(level.questions).map((question) => {
    const correctText = question.options[question.answer];
    const options = shuffle(question.options);
    return {
      ...question,
      options,
      answer: options.indexOf(correctText)
    };
  });
}

export function percentOf(score, total) {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function starsFor(percent) {
  if (percent >= 90) return 3;
  if (percent >= 75) return 2;
  if (percent >= 60) return 1;
  return 0;
}

export function isLevelUnlocked(index, best) {
  if (index === 0) return true;
  return (best[index - 1] ?? 0) >= PASS_PERCENT;
}

export function totalStars(levels, best) {
  return levels.reduce((sum, level, index) => sum + starsFor(best[index] ?? 0), 0);
}

export function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/* =========================================================
   تخزين التقدم
   ========================================================= */

export function emptyProgress() {
  return {
    best: {},
    fastest: {},
    sound: true,
    session: null,
    updatedAt: 0
  };
}

function isValidSession(session) {
  return Boolean(
    session &&
      Number.isInteger(session.levelIndex) &&
      Array.isArray(session.questions) &&
      session.questions.length > 0 &&
      Number.isInteger(session.index) &&
      session.index >= 0 &&
      session.index < session.questions.length &&
      Number.isFinite(session.timeLeft) &&
      session.timeLeft > 0 &&
      Number.isFinite(session.timeLimit) &&
      Array.isArray(session.answers)
  );
}

export function normalizeProgress(raw) {
  const base = emptyProgress();
  if (!raw || typeof raw !== "object") return base;

  const best = {};
  const fastest = {};

  if (raw.best && typeof raw.best === "object") {
    Object.entries(raw.best).forEach(([key, value]) => {
      const num = Number(value);
      if (Number.isFinite(num) && num >= 0 && num <= 100) best[key] = num;
    });
  }

  if (raw.fastest && typeof raw.fastest === "object") {
    Object.entries(raw.fastest).forEach(([key, value]) => {
      const num = Number(value);
      if (Number.isFinite(num) && num > 0) fastest[key] = num;
    });
  }

  base.best = best;
  base.fastest = fastest;
  base.sound = raw.sound !== false;
  base.session = isValidSession(raw.session) ? raw.session : null;
  base.updatedAt = Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0;
  return base;
}

/* دمج أفضل النتائج وأسرع الأوقات بين نسختين دون فقدان تقدم */
export function mergeProgress(current, incoming) {
  const a = normalizeProgress(current);
  const b = normalizeProgress(incoming);
  const merged = { ...a, best: { ...a.best }, fastest: { ...a.fastest } };

  Object.entries(b.best).forEach(([key, value]) => {
    if (value > (merged.best[key] ?? 0)) merged.best[key] = value;
  });

  Object.entries(b.fastest).forEach(([key, value]) => {
    const existing = merged.fastest[key];
    if (!existing || value < existing) merged.fastest[key] = value;
  });

  if (b.session && (b.session.updatedAt ?? 0) > (a.session?.updatedAt ?? 0)) {
    merged.session = b.session;
  }

  merged.updatedAt = Math.max(a.updatedAt ?? 0, b.updatedAt ?? 0);
  return merged;
}

export function readStore(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* التخزين غير متاح */
  }
}

/* عبارات التحفيز حسب النتيجة والسرعة */
export function getMotivation({ percent, isFast, isRecord, timedOut, passed }) {
  if (timedOut && passed) {
    return "انتهى الوقت، لكنك حققت نسبة الاجتياز! أحسنتَ يا طالب القرآن وواصل على هذا النهج ⏳";
  }
  if (timedOut) {
    return "انتهى الوقت يا بطل! لا تحزن، راجع الشرح وأعد المحاولة، فالمتأني يبلغ المراد ⏳";
  }
  if (isFast && percent === 100) {
    return "أحسنتَ يا طالب القرآن! إتقانٌ كامل في وقت قياسي، واصل على هذا النهج 🌟";
  }
  if (isFast) {
    return "ما شاء الله! سرعةٌ ودرجةٌ عالية، أحسنتَ يا طالب القرآن وواصل على هذا النهج 🏆";
  }
  if (isRecord && percent >= 90) {
    return "رقم قياسي جديد! أحسنتَ يا طالب القرآن وواصل على هذا النهج ⚡";
  }
  if (percent === 100) {
    return "علامة كاملة! أنت من أبطال التجويد، واصل على هذا النهج 🌟";
  }
  if (percent >= 90) {
    return "أداء رائع! أحسنتَ يا طالب القرآن وواصل على هذا النهج 🏆";
  }
  if (percent >= PASS_PERCENT) {
    return "أحسنت! اجتزت المرحلة بنجاح، وبالمزيد من التدريب تصل إلى الإتقان 💪";
  }
  return "لا بأس يا بطل! كل محاولة تقربك من الإتقان، راجع الشرح وحاول مرة أخرى 🌱";
}
