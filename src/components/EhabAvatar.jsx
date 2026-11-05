import { useId } from "react";

/* شخصية إيهاب الكرتونية — SVG خفيف وقابل للتكبير */
export default function EhabAvatar({ className = "", title = "إيهاب" }) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const skyId = `sky-${uid}`;
  const thobeId = `thobe-${uid}`;

  return (
    <svg
      viewBox="0 0 120 120"
      className={`ehab-svg ${className}`}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={skyId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a7f3d0" />
          <stop offset="1" stopColor="#bae6fd" />
        </linearGradient>
        <linearGradient id={thobeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>

      <circle cx="60" cy="60" r="58" fill={`url(#${skyId})`} />

      {/* الجسم والثوب */}
      <path
        d="M60 66c-15 0-26 9-30 25 8 5 18 8 30 8s22-3 30-8c-4-16-15-25-30-25Z"
        fill={`url(#${thobeId})`}
      />
      <path d="M60 66c-5 0-9 1-12 3l12 12 12-12c-3-2-7-3-12-3Z" fill="#f8fafc" />

      {/* الكتاب */}
      <path
        d="M60 90 46 95v11l14-5Z"
        fill="#fef3c7"
        stroke="#d97706"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M60 90l14 5v11l-14-5Z"
        fill="#fde68a"
        stroke="#d97706"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M60 90v11" stroke="#d97706" strokeWidth="1.2" />
      <circle cx="45" cy="94" r="4.5" fill="#fcd9b6" />
      <circle cx="75" cy="94" r="4.5" fill="#fcd9b6" />

      {/* الرقبة والأذنان */}
      <rect x="55" y="58" width="10" height="12" rx="4" fill="#f3c39a" />
      <circle cx="39" cy="47" r="5" fill="#fcd9b6" />
      <circle cx="81" cy="47" r="5" fill="#fcd9b6" />

      {/* الوجه */}
      <circle cx="60" cy="45" r="21" fill="#fcd9b6" />
      <path
        d="M41 41c1-10 9-17 19-17s18 7 19 17c-4-4-11-6-19-6s-15 2-19 6Z"
        fill="#3f2a1d"
      />

      {/* الطاقية */}
      <path
        d="M41 34c0-11 8-19 19-19s19 8 19 19c0 2-8 4-19 4s-19-2-19-4Z"
        fill="#f8fafc"
        stroke="#e2e8f0"
        strokeWidth="1.4"
      />
      <path
        d="M41 34c0 2 8 4 19 4s19-2 19-4"
        fill="none"
        stroke="#cbd5e1"
        strokeWidth="2"
      />

      {/* الحواجب والعينان */}
      <path d="M49 42h6M65 42h6" stroke="#3f2a1d" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="52" cy="48" rx="4.6" ry="5.4" fill="#fff" />
      <ellipse cx="68" cy="48" rx="4.6" ry="5.4" fill="#fff" />
      <circle cx="52.5" cy="49" r="2.8" fill="#1f2937" />
      <circle cx="68.5" cy="49" r="2.8" fill="#1f2937" />
      <circle cx="53.6" cy="47.8" r="1" fill="#fff" />
      <circle cx="69.6" cy="47.8" r="1" fill="#fff" />

      {/* الوجنتان والأنف والابتسامة */}
      <circle cx="45" cy="56" r="4" fill="#fb7185" opacity=".35" />
      <circle cx="75" cy="56" r="4" fill="#fb7185" opacity=".35" />
      <path d="M60 50v4" stroke="#e8a87c" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M53 57q7 6 14 0"
        fill="none"
        stroke="#a16207"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
