import { Info, Lightbulb, TriangleAlert } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { Block } from "@/modules/help/types";

/** `**negrita**` → <strong>. Solo ese formato: el contenido es del código, pero no se interpreta HTML. */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\*\*[^*]+\*\*)/g)
        .map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={i}>{part.slice(2, -2)}</strong>
          ) : (
            <Fragment key={i}>{part}</Fragment>
          ),
        )}
    </>
  );
}

const CALLOUT = {
  tip: { icon: Lightbulb, label: "Consejo", cls: "border-emerald-600/40 bg-emerald-600/10" },
  warn: { icon: TriangleAlert, label: "Importante", cls: "border-amber-600/50 bg-amber-500/10" },
  note: { icon: Info, label: "Nota", cls: "border-sky-600/40 bg-sky-600/10" },
} as const;

export function BlockView({ block }: { block: Block }) {
  switch (block.t) {
    case "p":
      return (
        <p className="leading-relaxed">
          <Inline text={block.text} />
        </p>
      );
    case "steps":
      return (
        <div className="space-y-2">
          {block.title && <h3 className="font-semibold">{block.title}</h3>}
          <ol className="space-y-2">
            {block.items.map((it, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden
                  className="bg-primary text-primary-foreground mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold"
                >
                  {i + 1}
                </span>
                <span className="leading-relaxed">
                  <Inline text={it} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      );
    case "list":
      return (
        <div className="space-y-2">
          {block.title && <h3 className="font-semibold">{block.title}</h3>}
          <ul className="list-disc space-y-1.5 pl-5 leading-relaxed">
            {block.items.map((it, i) => (
              <li key={i}>
                <Inline text={it} />
              </li>
            ))}
          </ul>
        </div>
      );
    case "defs":
      return (
        <dl className="divide-y rounded-lg border">
          {block.items.map((d) => (
            <div key={d.term} className="grid gap-1 p-3 sm:grid-cols-[12rem_1fr]">
              <dt className="font-semibold">{d.term}</dt>
              <dd className="leading-relaxed">
                <Inline text={d.def} />
              </dd>
            </div>
          ))}
        </dl>
      );
    default: {
      const c = CALLOUT[block.t];
      const Icon = c.icon;
      return (
        <div className={cn("flex gap-3 rounded-lg border p-3", c.cls)} role="note">
          <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="leading-relaxed">
            <span className="font-semibold">{c.label}: </span>
            <Inline text={block.text} />
          </p>
        </div>
      );
    }
  }
}
