"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { signAttendanceAction, type AttendanceResult } from "./actions";

type Q = { id: string; question: string; options: string[] };

/** Lienzo de firma táctil: dibuja con el dedo o el mouse y exporta un PNG. */
function SignaturePad({ onChange }: { onChange: (png: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = 200 * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
  }, []);
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        aria-label="Área para firmar"
        className="h-[200px] w-full touch-none rounded-md border bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          ref.current!.setPointerCapture(e.pointerId);
          const ctx = ref.current!.getContext("2d")!;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = ref.current!.getContext("2d")!;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          dirty.current = true;
        }}
        onPointerUp={() => {
          drawing.current = false;
          if (dirty.current) onChange(ref.current!.toDataURL("image/png"));
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          const c = ref.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          dirty.current = false;
          onChange(null);
        }}
      >
        Borrar firma
      </Button>
    </div>
  );
}

export function AttendanceForm({ token, questions }: { token: string; questions: Q[] }) {
  const [doc, setDoc] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null));
  const [res, setRes] = useState<AttendanceResult | null>(null);
  const [pending, start] = useTransition();
  if (res?.ok) return <Alert variant={res.passed ? "success" : "warning"}>{res.message}</Alert>;
  const ready = /^\d{5,15}$/.test(doc.trim()) && sig && answers.every((a) => a !== null);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () =>
          setRes(
            await signAttendanceAction({ token, document: doc.trim(), signature: sig!, answers }),
          ),
        );
      }}
    >
      {res && !res.ok && <Alert variant="destructive">{res.message}</Alert>}
      <div className="space-y-1">
        <Label htmlFor="document">Número de documento</Label>
        <Input
          id="document"
          inputMode="numeric"
          autoComplete="off"
          value={doc}
          onChange={(e) => setDoc(e.target.value)}
          required
        />
      </div>
      {questions.map((q, i) => (
        <fieldset key={q.id} className="space-y-1">
          <legend className="text-sm font-medium">
            {i + 1}. {q.question}
          </legend>
          {q.options.map((o, j) => (
            <label key={j} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="radio"
                name={`q${i}`}
                className="size-5"
                checked={answers[i] === j}
                onChange={() => setAnswers((a) => a.map((x, k) => (k === i ? j : x)))}
              />{" "}
              {o}
            </label>
          ))}
        </fieldset>
      ))}
      <div className="space-y-1">
        <Label>Firma</Label>
        <SignaturePad onChange={setSig} />
      </div>
      <Button type="submit" disabled={!ready || pending} className="w-full">
        {pending ? "Registrando…" : "Registrar mi asistencia"}
      </Button>
    </form>
  );
}
