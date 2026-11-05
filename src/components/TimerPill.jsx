import { formatTime } from "../lib/game.js";

export default function TimerPill({ seconds, paused }) {
  const tone = seconds <= 20 ? "danger" : seconds <= 60 ? "warn" : "safe";

  return (
    <div
      className={`timer-pill ${tone} ${paused ? "paused" : ""}`}
      role="timer"
      aria-label={`الوقت المتبقي ${formatTime(seconds)}`}
    >
      <span className="timer-icon" aria-hidden="true">
        {paused ? "⏸" : "⏱"}
      </span>
      <span className="timer-value">{formatTime(seconds)}</span>
      <span className="timer-label">{paused ? "متوقف" : "متبقٍ"}</span>
    </div>
  );
}
