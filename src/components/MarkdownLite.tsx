// Minimal markdown renderer for coach replies.
// Supports: **bold**, *italic*, line breaks, "- " bullet lists.
// Intentionally tiny — we don't want to ship react-markdown for short replies.

import { Fragment, type ReactNode } from "react";

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Split on **bold** and *italic* while preserving order
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = regex.exec(text))) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(<strong key={`b-${k++}`} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={`i-${k++}`}>{tok.slice(1, -1)}</em>);
    }
    lastIndex = m.index + tok.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export function MarkdownLite({ children, className = "" }: { children: string; className?: string }) {
  const lines = children.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  let para: string[] = [];

  const flushBullets = (key: string) => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${key}`} className="list-disc pl-5 space-y-1 my-2">
        {bullets.map((b, i) => (
          <li key={i}>{renderInline(b)}</li>
        ))}
      </ul>
    );
    bullets = [];
  };
  const flushPara = (key: string) => {
    if (!para.length) return;
    blocks.push(
      <p key={`p-${key}`} className="leading-relaxed">
        {para.map((line, i) => (
          <Fragment key={i}>
            {renderInline(line)}
            {i < para.length - 1 && <br />}
          </Fragment>
        ))}
      </p>
    );
    para = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara(`${idx}`);
      bullets.push(line.replace(/^\s*[-*]\s+/, ""));
    } else if (line.trim() === "") {
      flushBullets(`${idx}`);
      flushPara(`${idx}`);
    } else {
      flushBullets(`${idx}`);
      para.push(line);
    }
  });
  flushBullets("end");
  flushPara("end");

  return <div className={className}>{blocks}</div>;
}
