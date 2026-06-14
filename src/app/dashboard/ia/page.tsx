"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { PageHeader } from "@/components/dashboard/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { runAiTask, type IaTask } from "@/actions/ia";

const TOOLS: { value: IaTask; label: string }[] = [
  { value: "copy_politico", label: "Generador de copys políticos/comunitarios" },
  { value: "resumen_solicitudes", label: "Resumen de solicitudes" },
  { value: "clasificar_caso", label: "Clasificación automática de casos" },
  { value: "generar_acta", label: "Generador de actas" },
  { value: "generar_comunicado", label: "Generador de comunicados" },
  { value: "resumen_territorial", label: "Resumen territorial" },
  { value: "buscar_documentos", label: "Buscador inteligente de documentos" },
];

export default function IaPage() {
  const [task, setTask] = useState<IaTask>("copy_politico");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [pending, start] = useTransition();

  return (
    <>
      <PageHeader
        title="Asistente IA"
        description="Copiloto con revisión humana. Nunca publica de forma automática."
      />

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        ⚠️ <strong>Human-in-the-loop:</strong> la IA produce borradores. Toda salida
        debe ser revisada y aprobada por una persona antes de usarse. Actualmente
        en modo <strong>mock</strong> (conecta <code>OPENAI_API_KEY</code> para generación real).
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <label className="text-sm font-medium">Herramienta</label>
            <Select value={task} onValueChange={(v) => setTask(v as IaTask)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TOOLS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="text-sm font-medium">Entrada / contexto</label>
            <Textarea
              rows={8}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pega aquí el texto, solicitud, tema o contexto…"
            />
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await runAiTask(task, input);
                  if (res.ok && res.data) setOutput(res.data.output);
                  else toast.error(res.message);
                })
              }
            >
              <Sparkles className="size-4" /> {pending ? "Generando…" : "Generar borrador"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <label className="text-sm font-medium">Resultado (borrador)</label>
            <pre className="mt-2 min-h-[260px] whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">
              {output || "El borrador aparecerá aquí…"}
            </pre>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
