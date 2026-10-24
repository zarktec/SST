"use client";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/** Lleva a la persona al ingreso de su empresa (`empresa.<dominio>/login`): el dominio principal no tiene sesión propia. */
export function CompanyLoginForm({ root }: { root: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const slug = String(new FormData(e.currentTarget).get("slug") ?? "")
          .trim()
          .toLowerCase()
          .replace(new RegExp(`\\.${root.replace(/\./g, "\\.")}.*$`), "")
          .replace(/^https?:\/\//, "");
        if (!/^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$/.test(slug))
          return setError("Escribe la dirección de tu empresa (solo letras, números y guiones).");
        window.location.assign(`https://${slug}.${root}/login`);
      }}
    >
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="space-y-1">
        <Label htmlFor="slug">Dirección de tu empresa</Label>
        <div className="flex items-center gap-2">
          <Input id="slug" name="slug" autoComplete="off" placeholder="miempresa" required />
          <span className="text-muted-foreground text-sm">.{root}</span>
        </div>
      </div>
      <Button type="submit">Continuar</Button>
    </form>
  );
}
