"use client";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { FormState } from "@/lib/form-state";
import { requirementAction } from "../actions";

export function AddRequirement({ courses }: { courses: { id: string; name: string }[] }) {
  const [position, setPosition] = useState("");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardTitle>Agregar requisito</CardTitle>
      <div className="mt-3 space-y-3">
        {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.message}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="req-position">Cargo</Label>
            <Input
              id="req-position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Soldador"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="req-course">Curso exigido</Label>
            <Select
              id="req-course"
              className="border-input bg-background min-h-11 w-full rounded-md border px-3 text-base"
              defaultValue={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button
          disabled={pending || !position.trim()}
          onClick={() =>
            start(async () => setMsg(await requirementAction(position, courseId, true)))
          }
        >
          Agregar
        </Button>
      </div>
    </Card>
  );
}
