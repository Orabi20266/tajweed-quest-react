export default function OptionButton({ letter, text, state, disabled, onClick }) {
  const mark = state === "correct" ? "✓" : state === "wrong" ? "✕" : "";

  return (
    <button
      type="button"
      className="option"
      data-state={state}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="opt-letter" aria-hidden="true">
        {letter}
      </span>
      <span className="opt-text">{text}</span>
      <span className="opt-mark" aria-hidden="true">
        {mark}
      </span>
    </button>
  );
}
