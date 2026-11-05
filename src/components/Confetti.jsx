import { useEffect, useState } from "react";

const COLORS = ["#7c3aed", "#22c55e", "#f59e0b", "#ec4899", "#0ea5e9", "#f43f5e", "#14b8a6"];

/* قصاصات احتفال خفيفة بالـ CSS، تختفي تلقائياً */
export default function Confetti({ trigger, originX = 50, originY = 40, count = 34 }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!trigger) return undefined;

    const next = Array.from({ length: count }, (_, index) => ({
      id: `${trigger}-${index}`,
      left: originX + (Math.random() * 34 - 17),
      top: originY + (Math.random() * 12 - 6),
      color: COLORS[index % COLORS.length],
      dx: Math.random() * 280 - 140,
      dy: 140 + Math.random() * 240,
      rot: Math.random() * 760 - 380,
      delay: Math.random() * 0.12,
      width: 6 + Math.random() * 6,
      height: 9 + Math.random() * 9,
      round: Math.random() > 0.72
    }));

    setPieces(next);
    const timer = setTimeout(() => setPieces([]), 1600);
    return () => clearTimeout(timer);
  }, [trigger, count, originX, originY]);

  if (pieces.length === 0) return null;

  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className={`confetti-piece ${piece.round ? "round" : ""}`}
          style={{
            left: `${piece.left}%`,
            top: `${piece.top}%`,
            width: `${piece.width}px`,
            height: `${piece.height}px`,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            "--dx": `${piece.dx}px`,
            "--dy": `${piece.dy}px`,
            "--rot": `${piece.rot}deg`
          }}
        />
      ))}
    </div>
  );
}
