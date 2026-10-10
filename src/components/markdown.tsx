import { Fragment } from "react";

// Tiny, safe markdown subset for chat answers: paragraphs, "- " bullets,
// **bold**, _italic_ and `code`. No raw HTML is ever rendered.
function inline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g);
  return parts.map((p, i) => {
    const key = `${keyPrefix}-${i}`;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={key} className="font-semibold text-text">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={key} className="rounded bg-surface-3 px-1 text-[0.9em]">{p.slice(1, -1)}</code>;
    if (p.startsWith("_") && p.endsWith("_") && p.length > 2) return <em key={key} className="text-muted">{p.slice(1, -1)}</em>;
    return <Fragment key={key}>{p}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-2.5">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l) || !l.trim());
        if (isList) {
          return (
            <ul key={bi} className="space-y-1.5 pl-1">
              {lines.filter((l) => l.trim()).map((l, li) => (
                <li key={li} className="flex gap-2">
                  <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                  <span>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""), `${bi}-${li}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        // Mixed block: leading text line(s) followed by bullets.
        const firstBullet = lines.findIndex((l) => /^\s*[-*•]\s+/.test(l));
        if (firstBullet > 0) {
          return (
            <div key={bi} className="space-y-1.5">
              <p>{inline(lines.slice(0, firstBullet).join(" "), `${bi}-p`)}</p>
              <Markdown text={lines.slice(firstBullet).join("\n")} />
            </div>
          );
        }
        return <p key={bi}>{inline(lines.join(" "), `${bi}`)}</p>;
      })}
    </div>
  );
}
