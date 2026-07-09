import React from "react";

// Renderizador de Markdown liviano y seguro (sin dependencias ni HTML crudo).
// Soporta encabezados, negrita, cursiva, código en línea, enlaces, listas con
// viñetas y numeradas, y separadores. Construye nodos de React (no usa
// dangerouslySetInnerHTML), así que es seguro para mostrar salida de IA.

const INLINE = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)|(_([^_]+)_)/g;

function renderInline(text: string, kp: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) {
      nodes.push(
        <a key={`${kp}a${i}`} href={m[3]} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
          {m[2]}
        </a>,
      );
    } else if (m[4]) {
      nodes.push(<strong key={`${kp}b${i}`} className="font-semibold text-foreground">{m[5]}</strong>);
    } else if (m[6]) {
      nodes.push(<code key={`${kp}c${i}`} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{m[7]}</code>);
    } else if (m[8]) {
      nodes.push(<em key={`${kp}i${i}`}>{m[9]}</em>);
    } else if (m[10]) {
      nodes.push(<em key={`${kp}j${i}`}>{m[11]}</em>);
    }
    last = INLINE.lastIndex;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ content, className }: { content: string; className?: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  let k = 0;
  let i = 0;

  const flush = () => {
    if (para.length) {
      const key = `p${k++}`;
      blocks.push(
        <p key={key} className="mb-2.5 text-sm leading-relaxed text-muted-foreground">
          {renderInline(para.join(" "), key)}
        </p>,
      );
      para = [];
    }
  };

  while (i < lines.length) {
    const t = (lines[i] ?? "").trim();
    const indented = /^\s{2,}[-*]\s+/.test(lines[i] ?? "");

    if (!t) { flush(); i++; continue; }

    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush();
      const lvl = (h[1] ?? "").length;
      const key = `h${k++}`;
      const cls = lvl <= 2 ? "mb-2 mt-4 text-base font-bold" : "mb-1.5 mt-3 text-sm font-semibold";
      blocks.push(<p key={key} className={cls}>{renderInline(h[2] ?? "", key)}</p>);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flush();
      blocks.push(<hr key={`hr${k++}`} className="my-3 border-border" />);
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(t)) {
      flush();
      const items: { text: string; sub: boolean }[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? "")) {
        const sub = /^\s{2,}[-*]\s+/.test(lines[i] ?? "");
        items.push({ text: (lines[i] ?? "").replace(/^\s*[-*]\s+/, ""), sub });
        i++;
      }
      const key = `ul${k++}`;
      blocks.push(
        <ul key={key} className="mb-3 ml-4 list-disc space-y-1 text-sm text-muted-foreground marker:text-primary/60">
          {items.map((it, n) => (
            <li key={n} className={it.sub ? "ml-4 leading-relaxed" : "leading-relaxed"}>
              {renderInline(it.text, `${key}-${n}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(t)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      const key = `ol${k++}`;
      blocks.push(
        <ol key={key} className="mb-3 ml-4 list-decimal space-y-1 text-sm text-muted-foreground marker:font-semibold marker:text-primary/70">
          {items.map((it, n) => (
            <li key={n} className="leading-relaxed">{renderInline(it, `${key}-${n}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    void indented;
    para.push(t);
    i++;
  }
  flush();

  return <div className={className}>{blocks}</div>;
}
