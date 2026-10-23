"use client";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SignaturePad } from "@/components/ui/signature-pad";
import { signAttendanceAction, type AttendanceResult } from "./actions";

type Q = { id: string; question: string; options: string[] };

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
