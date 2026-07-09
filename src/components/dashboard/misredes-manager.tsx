"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink, Plus, Trash2, ArrowUp, ArrowDown, ImageUp, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { uploadFileViaSignedUrl } from "@/lib/upload";
import { saveMisredesConfig } from "@/actions/misredes";
import { type MisredesConfig } from "@/lib/misredes-shared";

type Cfg = MisredesConfig;

const REDES: { key: keyof Cfg["redes"]; label: string; ph: string }[] = [
  { key: "instagram", label: "Instagram", ph: "https://instagram.com/…" },
  { key: "tiktok", label: "TikTok", ph: "https://tiktok.com/@…" },
  { key: "youtube", label: "YouTube", ph: "https://youtube.com/@…" },
  { key: "x", label: "X (Twitter)", ph: "https://x.com/…" },
  { key: "threads", label: "Threads", ph: "https://threads.net/@…" },
  { key: "facebook", label: "Facebook", ph: "https://facebook.com/…" },
];

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function MisredesManager({ initial }: { initial: Cfg }) {
  const [cfg, setCfg] = useState<Cfg>(initial);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState<string | null>(null);

  const top = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setCfg((p) => ({ ...p, [k]: v }));
  const nested = <O extends "campana" | "redes" | "prensa">(o: O, k: keyof Cfg[O], v: unknown) =>
    setCfg((p) => ({ ...p, [o]: { ...p[o], [k]: v } }));

  const patchDest = (i: number, patch: Partial<Cfg["destacadas"][number]>) =>
    setCfg((p) => ({ ...p, destacadas: p.destacadas.map((d, j) => (j === i ? { ...d, ...patch } : d)) }));
  const patchEnl = (i: number, patch: Partial<Cfg["enlaces"][number]>) =>
    setCfg((p) => ({ ...p, enlaces: p.enlaces.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const patchFocus = (i: number, patch: Partial<Cfg["focus"][number]>) =>
    setCfg((p) => ({ ...p, focus: p.focus.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));
  const moveEnl = (i: number, dir: -1 | 1) =>
    setCfg((p) => {
      const j = i + dir;
      if (j < 0 || j >= p.enlaces.length) return p;
      const x = p.enlaces.slice();
      const tmp = x[i]!;
      x[i] = x[j]!;
      x[j] = tmp;
      return { ...p, enlaces: x };
    });

  async function uploadPhoto(field: "fotoUrl" | "fotoDestacada", file: File) {
    setUploading(field);
    try {
      const up = await uploadFileViaSignedUrl("contenido", "misredes", file);
      if (up.ok && up.url) top(field, up.url as never);
      else toast.error(up.message);
    } finally {
      setUploading(null);
    }
  }

  function save() {
    start(async () => {
      const res = await saveMisredesConfig(cfg);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Edita aquí la página pública. Los cambios se publican al guardar.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/misredes" target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" /> Ver página</a>
          </Button>
          <Button size="sm" onClick={save} disabled={pending}>
            <Save className="size-4" /> {pending ? "Guardando…" : "Guardar y publicar"}
          </Button>
        </div>
      </div>

      <Section title="Textos">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cargo"><Input value={cfg.cargo} onChange={(e) => top("cargo", e.target.value)} /></Field>
          <Field label="Periodo"><Input value={cfg.periodo} onChange={(e) => top("periodo", e.target.value)} /></Field>
          <Field label="Eyebrow (línea superior)"><Input value={cfg.eyebrow} onChange={(e) => top("eyebrow", e.target.value)} /></Field>
          <Field label="Ubicación"><Input value={cfg.ubicacion} onChange={(e) => top("ubicacion", e.target.value)} /></Field>
        </div>
        <Field label="Frase (bio)"><Input value={cfg.bio} onChange={(e) => top("bio", e.target.value)} /></Field>
        <Field label="Trayectoria (separada por comas)">
          <Input
            value={cfg.trayectoria.join(", ")}
            onChange={(e) => top("trayectoria", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
          />
        </Field>
      </Section>

      <Section title="Modo campaña" desc="Muestra el tarjetón con el número y (opcional) un contador.">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={cfg.campana.activa} onChange={(e) => nested("campana", "activa", e.target.checked)} />
          Mostrar número de tarjetón
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Número"><Input value={cfg.campana.numero} onChange={(e) => nested("campana", "numero", e.target.value)} placeholder="29" /></Field>
          <Field label="Fecha elección (opcional)"><Input type="datetime-local" value={cfg.campana.fechaEleccion} onChange={(e) => nested("campana", "fechaEleccion", e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="WhatsApp">
        <Field label="Número (con 57, solo dígitos)"><Input value={cfg.whatsapp} onChange={(e) => top("whatsapp", e.target.value)} placeholder="573001234567" /></Field>
      </Section>

      <Section title="Redes sociales" desc="Deja vacío para ocultar una red.">
        <div className="grid gap-3 sm:grid-cols-2">
          {REDES.map((r) => (
            <Field key={r.key} label={r.label}>
              <Input value={cfg.redes[r.key]} onChange={(e) => nested("redes", r.key, e.target.value)} placeholder={r.ph} />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Destacadas (J·A·I·R·O)" desc="Nombre y enlace de cada círculo destacado.">
        {cfg.destacadas.map((d, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr_2fr] items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{d.cover}</span>
            <Input value={d.label} onChange={(e) => patchDest(i, { label: e.target.value })} placeholder="Nombre" />
            <Input value={d.url} onChange={(e) => patchDest(i, { url: e.target.value })} placeholder="https://…" />
          </div>
        ))}
      </Section>

      <Section title="Enlaces (botones)">
        <div className="space-y-3">
          {cfg.enlaces.map((l, i) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="flex gap-2">
                <Input className="w-16 text-center" value={l.emoji} maxLength={4} onChange={(e) => patchEnl(i, { emoji: e.target.value })} placeholder="🔗" />
                <Input value={l.titulo} onChange={(e) => patchEnl(i, { titulo: e.target.value })} placeholder="Título" />
              </div>
              <Input className="mt-2" value={l.sub} onChange={(e) => patchEnl(i, { sub: e.target.value })} placeholder="Descripción corta" />
              <Input className="mt-2" value={l.url} onChange={(e) => patchEnl(i, { url: e.target.value })} placeholder="https://…" />
              <div className="mt-2 flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="size-7" disabled={i === 0} onClick={() => moveEnl(i, -1)}><ArrowUp className="size-4" /></Button>
                <Button variant="ghost" size="icon" className="size-7" disabled={i === cfg.enlaces.length - 1} onClick={() => moveEnl(i, 1)}><ArrowDown className="size-4" /></Button>
                <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => setCfg((p) => ({ ...p, enlaces: p.enlaces.filter((_, j) => j !== i) }))}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setCfg((p) => ({ ...p, enlaces: [...p.enlaces, { emoji: "🔗", titulo: "", sub: "", url: "" }] }))}>
            <Plus className="size-4" /> Agregar enlace
          </Button>
        </div>
      </Section>

      <Section title="Prensa y comunicaciones">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={cfg.prensa.mostrar} onChange={(e) => nested("prensa", "mostrar", e.target.checked)} />
          Mostrar sección de prensa
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Comunicados (enlace)"><Input value={cfg.prensa.comunicados} onChange={(e) => nested("prensa", "comunicados", e.target.value)} placeholder="https://…" /></Field>
          <Field label="Fotografías oficiales (enlace)"><Input value={cfg.prensa.fotografias} onChange={(e) => nested("prensa", "fotografias", e.target.value)} placeholder="https://…" /></Field>
          <Field label="Kit de prensa (enlace)"><Input value={cfg.prensa.kit} onChange={(e) => nested("prensa", "kit", e.target.value)} placeholder="https://…" /></Field>
          <Field label="Jefa/e de prensa — nombre"><Input value={cfg.prensa.contactoNombre} onChange={(e) => nested("prensa", "contactoNombre", e.target.value)} /></Field>
          <Field label="Jefa/e de prensa — WhatsApp (con 57)"><Input value={cfg.prensa.contactoNumero} onChange={(e) => nested("prensa", "contactoNumero", e.target.value)} placeholder="573001234567" /></Field>
        </div>
      </Section>

      <Section title="En qué trabajo (4 ejes)">
        {cfg.focus.map((f, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr] items-start gap-2 rounded-lg border p-3">
            <Input className="w-16 text-center" value={f.emoji} maxLength={4} onChange={(e) => patchFocus(i, { emoji: e.target.value })} />
            <div className="space-y-2">
              <Input value={f.titulo} onChange={(e) => patchFocus(i, { titulo: e.target.value })} placeholder="Título" />
              <Textarea rows={2} value={f.texto} onChange={(e) => patchFocus(i, { texto: e.target.value })} placeholder="Descripción" />
            </div>
          </div>
        ))}
      </Section>

      <Section title="Fotos (opcional)" desc="El logo del hero es la imagen de marca; estas son la foto de perfil y la destacada.">
        {(["fotoDestacada", "fotoUrl"] as const).map((field) => (
          <div key={field} className="space-y-2">
            <Label className="text-xs">{field === "fotoDestacada" ? "Foto destacada (centro de la página)" : "Foto de perfil (círculo pequeño)"}</Label>
            {cfg[field] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cfg[field]} alt="" className="h-24 w-full rounded-lg object-cover sm:w-40" />
            ) : (
              <div className="grid h-24 w-full place-items-center rounded-lg border border-dashed text-xs text-muted-foreground sm:w-40">Sin imagen</div>
            )}
            <div className="flex flex-wrap gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
                <ImageUp className="size-4" /> {uploading === field ? "Subiendo…" : "Subir"}
                <input type="file" accept="image/*" className="hidden" disabled={uploading === field}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(field, f); e.target.value = ""; }} />
              </label>
              <Input className="flex-1" value={cfg[field]} onChange={(e) => top(field, e.target.value as never)} placeholder="…o pega una URL" />
              {cfg[field] && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => top(field, "" as never)}>Quitar</Button>}
            </div>
          </div>
        ))}
      </Section>

      <div className="sticky bottom-32 flex justify-end lg:bottom-4">
        <Button onClick={save} disabled={pending} className="shadow-lg">
          <Save className="size-4" /> {pending ? "Guardando…" : "Guardar y publicar"}
        </Button>
      </div>
    </div>
  );
}
