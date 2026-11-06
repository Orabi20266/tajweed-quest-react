/* =========================================================
   أدوات مرحلة التلاوة: تنظيف النص العربي، مطابقة الكلمات،
   وحساب دقة التلاوة وتصحيح الأخطاء
   ========================================================= */

export const RECITATION_MASTERED = 80;

const DIACRITICS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const NON_ARABIC_RE = /[^\u0621-\u064A\s]/g;

export function isSpeechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/* يزيل التشكيل ويوحّد الحروف المتشابهة لتحمّل اختلافات التعرف الصوتي */
export function normalizeArabic(text) {
  return String(text ?? "")
    .replace(DIACRITICS_RE, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ئ/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/ء/g, "")
    .replace(NON_ARABIC_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitWords(text) {
  const clean = String(text ?? "").trim();
  return clean ? clean.split(/\s+/) : [];
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      );
    }
    previous = current;
  }

  return previous[b.length];
}

/* نسبة تشابه كلمتين، مع تجاهل «ال» التعريف حتى لا تُحسب خطأً */
export function wordSimilarity(first, second) {
  const a = normalizeArabic(first);
  const b = normalizeArabic(second);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const raw = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  const aCore = a.replace(/^ال/, "");
  const bCore = b.replace(/^ال/, "");
  const core =
    aCore && bCore
      ? 1 - levenshtein(aCore, bCore) / Math.max(aCore.length, bCore.length)
      : 0;

  return Math.max(raw, core);
}

function matchWords(expected, heard) {
  const rows = expected.length;
  const cols = heard.length;
  const insertionCost = 0.7;

  const dp = Array.from({ length: rows + 1 }, () =>
    new Array(cols + 1).fill(0)
  );

  for (let i = 1; i <= rows; i += 1) dp[i][0] = i;
  for (let j = 1; j <= cols; j += 1) dp[0][j] = j * insertionCost;

  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      const similarity = wordSimilarity(expected[i - 1], heard[j - 1]);
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + insertionCost,
        dp[i - 1][j - 1] + (1 - similarity)
      );
    }
  }

  const matches = new Map();
  let i = rows;
  let j = cols;
  const EPS = 1e-9;

  while (i > 0 && j > 0) {
    const similarity = wordSimilarity(expected[i - 1], heard[j - 1]);
    const substitute = dp[i - 1][j - 1] + (1 - similarity);

    if (Math.abs(dp[i][j] - substitute) < EPS) {
      matches.set(i - 1, { word: heard[j - 1], similarity });
      i -= 1;
      j -= 1;
    } else if (Math.abs(dp[i][j] - (dp[i - 1][j] + 1)) < EPS) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  return matches;
}

/**
 * يقارن الآية المتوقعة بما سمعه المتصفح، ويعيد حالة كل كلمة
 * ودقة إجمالية. الكلمات القريبة تُحسب نصف درجة حتى لا يكون
 * التصحيح قاسياً مع اختلافات التعرف الصوتي.
 */
export function alignRecitation(expectedText, spokenText) {
  const expectedWords = splitWords(expectedText);
  const heardWords = splitWords(spokenText);
  const matches = matchWords(expectedWords, heardWords);

  const words = expectedWords.map((word, index) => {
    const match = matches.get(index);
    if (!match) {
      return { word, heard: "", status: "missing", similarity: 0 };
    }

    let status = "missing";
    if (match.similarity >= 0.995) status = "correct";
    else if (match.similarity >= 0.62) status = "close";

    return {
      word,
      heard: match.word,
      status,
      similarity: match.similarity
    };
  });

  const exactCount = words.filter((item) => item.status === "correct").length;
  const closeCount = words.filter((item) => item.status === "close").length;
  const missingCount = words.filter((item) => item.status === "missing").length;
  const total = words.length;
  const accuracy =
    total > 0 ? Math.round(((exactCount + closeCount * 0.5) / total) * 100) : 0;

  return {
    words,
    accuracy,
    exactCount,
    closeCount,
    missingCount,
    total,
    expectedWords,
    heardWords,
    transcript: String(spokenText ?? "").trim()
  };
}

/**
 * يبني نتيجة التلاوة من حكم Gemini على كل كلمة.
 * إن جاء عدد الأحكام مختلفاً عن عدد الكلمات نعود للمطابقة المحلية.
 */
export function buildResultFromVerdicts(expectedText, verdicts, transcript) {
  const expectedWords = splitWords(expectedText);
  const cleanTranscript = String(transcript ?? "").trim();

  if (!Array.isArray(verdicts) || verdicts.length !== expectedWords.length) {
    return alignRecitation(expectedText, cleanTranscript);
  }

  const allowed = new Set(["correct", "close", "missing"]);
  const words = expectedWords.map((word, index) => {
    const verdict = verdicts[index] ?? {};
    const status = allowed.has(verdict.status) ? verdict.status : "missing";
    return {
      word,
      heard: String(verdict.heard ?? "").trim(),
      status,
      similarity: status === "correct" ? 1 : status === "close" ? 0.75 : 0
    };
  });

  const exactCount = words.filter((item) => item.status === "correct").length;
  const closeCount = words.filter((item) => item.status === "close").length;
  const missingCount = words.filter((item) => item.status === "missing").length;
  const total = words.length;
  const accuracy =
    total > 0 ? Math.round(((exactCount + closeCount * 0.5) / total) * 100) : 0;

  return {
    words,
    accuracy,
    exactCount,
    closeCount,
    missingCount,
    total,
    expectedWords,
    heardWords: cleanTranscript ? splitWords(cleanTranscript) : [],
    transcript: cleanTranscript
  };
}

export function starsForRecitation(percent) {
  if (percent >= 95) return 3;
  if (percent >= RECITATION_MASTERED) return 2;
  if (percent >= 60) return 1;
  return 0;
}

export function getRecitationFeedback(result) {
  const { accuracy, transcript, closeCount, missingCount } = result;

  if (!transcript) {
    return {
      emoji: "🎙️",
      title: "لم أسمع تلاوتك",
      tone: "warn",
      message:
        "لم يصلني صوت واضح. تأكد من السماح للميكروفون، واقترب منه، ثم اقرأ الآية بصوت واضح."
    };
  }

  if (accuracy === 100) {
    return {
      emoji: "🌟",
      title: "تلاوة متقنة!",
      tone: "good",
      message:
        "أحسنتَ يا طالب القرآن وواصل على هذا النهج. نطقت جميع الكلمات بوضوح، وما شاء الله عليك."
    };
  }

  if (accuracy >= RECITATION_MASTERED) {
    return {
      emoji: "👏",
      title: "تلاوة رائعة!",
      tone: "good",
      message: `أتقنت معظم الآية. بقيت ${missingCount + closeCount} ${
        missingCount + closeCount === 1 ? "كلمة" : "كلمات"
      } تحتاج مراجعة بسيطة، استمع للتصحيح ثم أعد المحاولة لتصل إلى الإتقان.`
    };
  }

  if (accuracy >= 60) {
    return {
      emoji: "🌱",
      title: "بداية طيبة، أنت قريب!",
      tone: "close",
      message:
        "راجع الكلمات الملوّنة، واستمع للآية مرة أخرى، ثم اقرأها بتؤدة. القليل من التدريب يفصلك عن الإتقان."
    };
  }

  return {
    emoji: "📘",
    title: "تحتاج إلى مراجعة",
    tone: "warn",
    message:
      "لا بأس يا بطل! استمع للآية أولاً، ثم اقرأها كلمة كلمة بتؤدة. كل محاولة تقرّبك من الإتقان."
  };
}

/* عبارة تصحيح قصيرة تُعرض مع إيهاب */
export function buildCorrectionText(result, ayahTip) {
  if (!result.transcript) {
    return "لم أسمع صوتك بوضوح. اسمح للميكروفون واقترب منه، ثم اقرأ الآية بصوت واضح. " + ayahTip;
  }

  if (result.accuracy === 100) {
    return "ما شاء الله! نطقت كل كلمة بوضوح. " + ayahTip;
  }

  const first = result.words.find((item) => item.status !== "correct");
  let correction = "";

  if (first) {
    if (first.status === "missing") {
      correction = `لم أسمع كلمة «${first.word}» بوضوح. `;
    } else {
      correction = `كلمة «${first.word}» قريبة، لكن انطقها بوضوح: «${first.word}». `;
    }
  }

  return correction + ayahTip;
}
