import { useEffect, useState } from "react";
import { getGeminiKey, getGeminiVoice, subscribeGemini } from "../lib/gemini.js";

/* حالة مفتاح Gemini والصوت المختار، تتحدث فوراً عند تغييرهما */
export function useGeminiSettings() {
  const [state, setState] = useState(() => ({
    hasKey: Boolean(getGeminiKey()),
    voice: getGeminiVoice()
  }));

  useEffect(
    () =>
      subscribeGemini(() => {
        setState({
          hasKey: Boolean(getGeminiKey()),
          voice: getGeminiVoice()
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
