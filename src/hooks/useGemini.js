import { useEffect, useState } from "react";
import {
  getCorrectionVoice,
  getGeminiKey,
  getGeminiVoice,
  subscribeGemini
} from "../lib/gemini.js";

/* حالة مفتاح Gemini والأصوات المختارة، تتحدث فوراً عند تغييرها */
export function useGeminiSettings() {
  const [state, setState] = useState(() => ({
    hasKey: Boolean(getGeminiKey()),
    voice: getGeminiVoice(),
    correctionVoice: getCorrectionVoice()
  }));

  useEffect(
    () =>
      subscribeGemini(() => {
        setState({
          hasKey: Boolean(getGeminiKey()),
          voice: getGeminiVoice(),
          correctionVoice: getCorrectionVoice()
        });
      }),
    []
  );

  return state;
}

export function useGeminiKey() {
  const { hasKey } = useGeminiSettings();
  return hasKey;
}
