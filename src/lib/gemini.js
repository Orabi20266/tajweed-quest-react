/* =========================================================
   تكامل Gemini: أصوات TTS وتقييم تسجيل تلاوة الطالب
   ========================================================= */

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const KEY_STORAGE = "tajweed_gemini_key_v1";
const VOICE_STORAGE = "tajweed_gemini_voice_v1";
const CHANGE_EVENT = "tajweed:gemini-change";

export const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";

/* نماذج تفهم الصوت وتقيّم التلاوة، بالترتيب من الأسرع إلى الأقوى */
const EVALUATION_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.6-flash"
];

export const GEMINI_VOICES = [
  { id: "Puck", label: "Puck — حيوي وودود" },
  { id: "Kore", label: "Kore — واضح وثابت" },
  { id: "Zephyr", label: "Zephyr — مشرق" },
  { id: "Fenrir", label: "Fenrir — متحمس" },
  { id: "Aoede", label: "Aoede — هادئ" },
  { id: "Leda", label: "Leda — صوت شاب" }
];

/* ---------- إعدادات محفوظة على جهاز المستخدم ---------- */

function readStorage(key) {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStorage(key, value) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* قد يكون التخزين معطلاً */
  }
}

function notifyChange() {
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    /* تجاهل */
  }
}

export function getGeminiKey() {
  if (typeof window === "undefined") return "";
  return readStorage(KEY_STORAGE).trim();
}

export function setGeminiKey(value) {
  writeStorage(KEY_STORAGE, String(value ?? "").trim());
  notifyChange();
}

export function getGeminiVoice() {
  if (typeof window === "undefined") return "Puck";
  const saved = readStorage(VOICE_STORAGE).trim();
  return GEMINI_VOICES.some((voice) => voice.id === saved) ? saved : "Puck";
}

export function setGeminiVoice(value) {
  writeStorage(VOICE_STORAGE, String(value ?? "").trim());
  notifyChange();
}

export function subscribeGemini(listener) {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

/* ---------- أدوات تحويل الصوت ---------- */

function base64ToBytes(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read-failed"));
    reader.readAsDataURL(blob);
  });
}

function pcmToWavBlob(bytes, sampleRate = 24000) {
  // إن كان الصوت يحمل ترويسة WAV مسبقاً نعيده كما هو
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return new Blob([bytes], { type: "audio/wav" });
  }

  const buffer = new ArrayBuffer(44 + bytes.length);
  const view = new DataView(buffer);

  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + bytes.length, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, bytes.length, true);

  new Uint8Array(buffer, 44).set(bytes);
  return new Blob([buffer], { type: "audio/wav" });
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/* يحوّل تسجيل المتصفح (webm أو mp4) إلى WAV mono 16k يفهمه Gemini */
export async function recordingToWav(blob) {
  if (!blob || blob.size === 0) return blob;
  if (typeof window === "undefined") return blob;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!AudioCtx || !OfflineCtx) return blob;

  let context;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    context = new AudioCtx();
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    await context.close();

    const sampleRate = 16000;
    const frames = Math.max(1, Math.ceil(decoded.duration * sampleRate));
    const offline = new OfflineCtx(1, frames, sampleRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), sampleRate);
  } catch {
    try {
      await context?.close?.();
    } catch {
      /* تجاهل */
    }
    return blob;
  }
}

/* ---------- نداء Gemini ---------- */

async function callModel(model, body) {
  const key = getGeminiKey();
  if (!key) {
    const error = new Error("missing-key");
    error.code = "missing-key";
    throw error;
  }

  const response = await fetch(`${API_ROOT}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data?.error?.message || `فشل طلب Gemini (${response.status})`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

function extractInlineAudio(data) {
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      return {
        data: inline.data,
        mimeType: inline.mimeType || inline.mime_type || "audio/wav"
      };
    }
  }
  return null;
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

function rateStyle(rate) {
  if (rate <= 0.68) return "ببطء شديد ووضوح تام";
  if (rate <= 0.84) return "ببطء ووضوح";
  return "بصوت طبيعي واضح";
}

function buildSpeechPrompt(text, style) {
  return `اقرأ النص التالي باللغة العربية الفصحى، بصوت معلّم ودود وواضح، ${style}. لا تضف أي كلمات من عندك ولا تشرح، واقرأ النص فقط:\n${text}`;
}

const ttsCache = new Map();

/* يولّد صوتاً عربياً عبر Gemini TTS ويعيد رابط تشغيل مؤقت */
export function synthesizeSpeech(
  text,
  { voice = getGeminiVoice(), rate = 1, style = "" } = {}
) {
  const content = String(text ?? "").trim();
  if (!content) return Promise.reject(new Error("empty-text"));

  const key = getGeminiKey();
  if (!key) {
    const error = new Error("missing-key");
    error.code = "missing-key";
    return Promise.reject(error);
  }

  const spokenStyle = style || rateStyle(rate);
  const cacheId = `${key.slice(-6)}|${voice}|${spokenStyle}|${content}`;
  const cached = ttsCache.get(cacheId);
  if (cached) return cached;

  const promise = (async () => {
    const data = await callModel(GEMINI_TTS_MODEL, {
      contents: [
        {
          role: "user",
          parts: [{ text: buildSpeechPrompt(content, spokenStyle) }]
        }
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice }
          }
        }
      }
    });

    const audio = extractInlineAudio(data);
    if (!audio?.data) throw new Error("لم يُعد Gemini أي صوت");

    const bytes = base64ToBytes(audio.data);
    let blob;

    if (/l16|pcm/i.test(audio.mimeType)) {
      const rateMatch = /rate=(\d+)/i.exec(audio.mimeType);
      blob = pcmToWavBlob(bytes, rateMatch ? Number(rateMatch[1]) : 24000);
    } else {
      blob = new Blob([bytes], { type: audio.mimeType || "audio/wav" });
    }

    return URL.createObjectURL(blob);
  })();

  ttsCache.set(cacheId, promise);
  if (ttsCache.size > 60) {
    const oldest = ttsCache.keys().next().value;
    ttsCache.delete(oldest);
  }

  promise.catch(() => ttsCache.delete(cacheId));
  return promise;
}

/* ---------- تقييم تلاوة الطالب ---------- */

const VERDICT_SCHEMA = {
  type: "OBJECT",
  properties: {
    transcript: {
      type: "STRING",
      description: "ما قرأه الطالب حرفياً دون تصحيح أو إكمال"
    },
    verdicts: {
      type: "ARRAY",
      description: "حالة كل كلمة من كلمات الآية بنفس الترتيب والعدد",
      items: {
        type: "OBJECT",
        properties: {
          status: {
            type: "STRING",
            enum: ["correct", "close", "missing"]
          },
          heard: {
            type: "STRING",
            description: "الكلمة التي سُمعت فعلاً، أو نص فارغ"
          }
        },
        required: ["status", "heard"]
      }
    },
    note: {
      type: "STRING",
      description: "ملاحظة قصيرة بالعربية عن أهم خطأ، أو نص فارغ"
    }
  },
  required: ["transcript", "verdicts"]
};

function buildEvaluationPrompt(ayahText, words) {
  return `أنت معلّم تجويد لطيف للأطفال. ستصلك تسجيل صوتي لطفل يقرأ هذه الآية:
«${ayahText}»

كلمات الآية بالترتيب (${words.length} كلمة):
${words.map((word, index) => `${index + 1}. ${word}`).join("\n")}

استمع إلى التسجيل جيداً، ثم أعد النتيجة كـ JSON فقط:
- transcript: اكتب ما قرأه الطفل حرفياً كما سمعته، دون تصحيح أو إكمال من حفظك. إن لم تسمع شيئاً فاكتب "".
- verdicts: مصفوفة بنفس ترتيب الكلمات وبنفس عددها (${words.length} عنصراً). لكل كلمة:
  status = "correct" إذا نطقها صحيحة، أو "close" إذا نطقها قريبة مع خطأ بسيط في حرف أو حركة، أو "missing" إذا لم تُسمع.
  heard = الكلمة التي سمعتها فعلاً، أو "".
- note: ملاحظة قصيرة جداً بالعربية الفصحى عن أهم خطأ، أو "".

كن متسامحاً مع خفوت الصوت واختلاف اللهجة، ولا تحسب المدّ أو الغنّة أو ترقيق/تفخيم الحروف خطأً. لا تخترع كلمات لم يقلها الطفل.`;
}

export async function evaluateRecitation({ audio, ayahText, words }) {
  if (!audio || audio.size === 0) {
    const error = new Error("empty-audio");
    error.code = "empty-audio";
    throw error;
  }

  const wav = await recordingToWav(audio);
  const base64 = await blobToBase64(wav);
  const prompt = buildEvaluationPrompt(ayahText, words);

  let lastError = null;

  for (const model of EVALUATION_MODELS) {
    try {
      const data = await callModel(model, {
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: wav.type || "audio/wav",
                  data: base64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: VERDICT_SCHEMA
        }
      });

      const raw = extractText(data)
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
      const parsed = JSON.parse(raw);

      return {
        transcript: String(parsed.transcript ?? "").trim(),
        verdicts: Array.isArray(parsed.verdicts) ? parsed.verdicts : null,
        note: String(parsed.note ?? "").trim(),
        model
      };
    } catch (error) {
      lastError = error;
      /* مفتاح غير صالح أو محظور: لا فائدة من تجربة نموذج آخر */
      if (error?.status === 401 || error?.status === 403) break;
    }
  }

  throw lastError ?? new Error("evaluation-failed");
}
