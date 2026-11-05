import { useEffect, useState } from "react";

export default function ProgressRing({ percent, passed, label = "نتيجتك" }) {
  const size = 152;
  const stroke = 13;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(percent));
    return () => cancelAnimationFrame(frame);
  }, [percent]);

  return (
    <div className={`progress-ring ${passed ? "pass" : "fail"}`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle
          className="ring-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (shown / 100) * circumference}
        />
      </svg>
      <div className="ring-label">
        <strong>{percent}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
