export default function Help({ onClose }: { onClose: () => void }) {
  const keys: [string, string][] = [
    ["j / k", "scroll down / up"],
    ["n / p", "next / previous chapter"],
    ["t", "table of contents"],
    ["a", "clean mode (hide all notes)"],
    ["s", "toggle spoilers globally"],
    ["m", "dark / paper theme"],
    ["esc", "close panels"],
  ];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="help" onClick={(e) => e.stopPropagation()}>
        <div className="toc-head">
          <span className="overline">Shortcuts</span>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {keys.map(([k, v]) => (
          <div key={k} className="help-row">
            <span className="kbd">{k}</span>
            <span>{v}</span>
          </div>
        ))}
        <div className="help-note">
          Gold dotted underline = a note on hover (or tap). Gold solid
          underline with ❯ = opens a full reference page. Gray dotted
          underline = a plain word meaning. Bordered blocks near a paragraph
          are meant to be read before or after it. Confidence: ● certain · ◐
          likely · ○ uncertain.
        </div>
      </div>
    </div>
  );
}
