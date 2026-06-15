"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, Network, Paperclip, ListChecks,
  UserCheck, Upload, Link2, X, Plus, FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TaskStatusBadge, PriorityBadge } from "@/lib/status";
import { initials, formatDate } from "@/lib/utils";
import { CONTACT_TIPO_LABELS, type Contact } from "@/types/database";
import { uploadFileViaSignedUrl } from "@/lib/upload";
import {
  addRelation, removeRelation, addContactDocument, removeContactDocument, linkReferredCitizen,
} from "@/actions/contactos";
import { createTask } from "@/actions/tareas";

interface MiniContact { id: string; nombre: string; apellido: string | null; puesto: string | null }
interface MiniCitizen { id: string; nombre: string; apellido: string | null; localidad: string | null }
interface Relation { related_contact_id: string; tipo_relacion: string }
interface Doc { id: string; tipo: "archivo" | "link"; nombre: string; url: string; storage_path: string | null }
interface TaskMini { id: string; titulo: string; estado: string; prioridad: string; fecha_limite: string | null }

export function ContactDetail({
  contact, zoneName, allContacts, citizens,
  relations: relIni, documents: docIni, tasks: taskIni, referidos: refIni,
}: {
  contact: Contact;
  zoneName: string | null;
  allContacts: MiniContact[];
  citizens: MiniCitizen[];
  relations: Relation[];
  documents: Doc[];
  tasks: TaskMini[];
  referidos: MiniCitizen[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [relations, setRelations] = useState(relIni);
  const [documents, setDocuments] = useState(docIni);
  const [referidos, setReferidos] = useState(refIni);
  const [uploading, setUploading] = useState(false);

  const [relPick, setRelPick] = useState("");
  const [relTipo, setRelTipo] = useState("aliado");
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [refPick, setRefPick] = useState("");
  const [taskTitle, setTaskTitle] = useState("");

  const nameById = new Map(allContacts.map((c) => [c.id, `${c.nombre} ${c.apellido ?? ""}`.trim()]));
  const relatedIds = new Set(relations.map((r) => r.related_contact_id));
  const relCandidates = allContacts.filter((c) => c.id !== contact.id && !relatedIds.has(c.id));
  const refIds = new Set(referidos.map((r) => r.id));
  const citizenCandidates = citizens.filter((c) => !refIds.has(c.id));

  async function uploadDoc(file: File) {
    setUploading(true);
    try {
      const up = await uploadFileViaSignedUrl("contact-files", contact.id, file);
      if (!up.ok || !up.url) { toast.error(up.message); return; }
      const res = await addContactDocument({ contact_id: contact.id, tipo: "archivo", nombre: up.name!, url: up.url, storage_path: up.path, mime: up.mime, size: up.size });
      if (res.ok) { setDocuments((d) => [{ id: crypto.randomUUID(), tipo: "archivo", nombre: up.name!, url: up.url!, storage_path: up.path ?? null }, ...d]); }
      else toast.error(res.message);
    } finally { setUploading(false); }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link href="/dashboard/contactos"><ArrowLeft className="size-4" /> Contactos</Link>
      </Button>

      {/* Cabecera tipo vCard */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-2xl font-bold text-white">
            {contact.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={contact.foto_url} alt="" className="size-full object-cover" />
            ) : initials(`${contact.nombre} ${contact.apellido ?? ""}`)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{contact.nombre} {contact.apellido ?? ""}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {contact.puesto && <span>{contact.puesto}</span>}
              <Badge variant="muted">{CONTACT_TIPO_LABELS[contact.tipo] ?? contact.tipo}</Badge>
              {contact.influencia && <Badge variant="secondary">Influencia {contact.influencia}</Badge>}
            </div>
            <div className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              {contact.organizacion && <p className="flex items-center gap-2"><Building2 className="size-3.5" />{contact.organizacion}</p>}
              {(contact.whatsapp || contact.telefono) && <p className="flex items-center gap-2"><Phone className="size-3.5" />{contact.whatsapp || contact.telefono}</p>}
              {contact.email && <p className="flex items-center gap-2"><Mail className="size-3.5" />{contact.email}</p>}
              {(zoneName || contact.localidad) && <p className="flex items-center gap-2"><MapPin className="size-3.5" />{zoneName || contact.localidad}{contact.barrio ? ` · ${contact.barrio}` : ""}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {contact.notas && (
        <Card className="mb-4"><CardContent className="p-4 text-sm text-muted-foreground whitespace-pre-wrap">{contact.notas}</CardContent></Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Red de contactos */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold"><Network className="size-4" /> Red de contactos</h3>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {relations.length === 0 && <span className="text-sm text-muted-foreground">Sin relaciones.</span>}
              {relations.map((r) => (
                <Badge key={r.related_contact_id} variant="secondary" className="gap-1">
                  <Link href={`/dashboard/contactos/${r.related_contact_id}`} className="hover:underline">
                    {nameById.get(r.related_contact_id) ?? "Contacto"}
                  </Link>
                  <span className="text-[10px] opacity-70">({r.tipo_relacion})</span>
                  <button onClick={() => start(async () => {
                    const res = await removeRelation(contact.id, r.related_contact_id);
                    if (res.ok) setRelations((x) => x.filter((y) => y.related_contact_id !== r.related_contact_id));
                    else toast.error(res.message);
                  })}><X className="size-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={relPick} onValueChange={setRelPick}>
                <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Vincular contacto" /></SelectTrigger>
                <SelectContent>
                  {relCandidates.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre} {c.apellido ?? ""}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={relTipo} onValueChange={setRelTipo}>
                <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aliado">Aliado</SelectItem>
                  <SelectItem value="colega">Colega</SelectItem>
                  <SelectItem value="jefe">Jefe</SelectItem>
                  <SelectItem value="familiar">Familiar</SelectItem>
                  <SelectItem value="referido">Referido</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => {
                if (!relPick) return;
                start(async () => {
                  const res = await addRelation(contact.id, relPick, relTipo);
                  if (res.ok) { setRelations((x) => [...x, { related_contact_id: relPick, tipo_relacion: relTipo }]); setRelPick(""); }
                  else toast.error(res.message);
                });
              }}><Plus className="size-4" /></Button>
            </div>
          </CardContent>
        </Card>

        {/* Documentos */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold"><Paperclip className="size-4" /> Documentos</h3>
            <ul className="mb-3 space-y-1.5">
              {documents.length === 0 && <li className="text-sm text-muted-foreground">Sin documentos.</li>}
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                  {d.tipo === "link" ? <Link2 className="size-4 shrink-0 text-primary" /> : <FileText className="size-4 shrink-0 text-primary" />}
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">{d.nombre}</a>
                  <button className="text-muted-foreground hover:text-destructive" onClick={() => start(async () => {
                    const res = await removeContactDocument(d.id, d.storage_path);
                    if (res.ok) setDocuments((x) => x.filter((y) => y.id !== d.id)); else toast.error(res.message);
                  })}><X className="size-4" /></button>
                </li>
              ))}
            </ul>
            <label className="mb-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50">
              <Upload className="size-4" /> {uploading ? "Subiendo…" : "Subir documento (cualquier tipo)"}
              <input type="file" className="hidden" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(f); e.target.value = ""; }} />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input placeholder="Nombre" value={linkName} onChange={(e) => setLinkName(e.target.value)} className="sm:w-32" />
              <Input placeholder="https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="flex-1" />
              <Button variant="outline" onClick={() => {
                if (!linkUrl.trim()) return toast.error("Pega un enlace.");
                start(async () => {
                  const res = await addContactDocument({ contact_id: contact.id, tipo: "link", nombre: linkName.trim() || linkUrl.trim(), url: linkUrl.trim() });
                  if (res.ok) { setDocuments((x) => [{ id: crypto.randomUUID(), tipo: "link", nombre: linkName.trim() || linkUrl.trim(), url: linkUrl.trim(), storage_path: null }, ...x]); setLinkName(""); setLinkUrl(""); }
                  else toast.error(res.message);
                });
              }}><Link2 className="size-4" /></Button>
            </div>
          </CardContent>
        </Card>

        {/* Tareas */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold"><ListChecks className="size-4" /> Tareas para este contacto</h3>
            <ul className="mb-3 space-y-1.5">
              {taskIni.length === 0 && <li className="text-sm text-muted-foreground">Sin tareas.</li>}
              {taskIni.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                  <span className="min-w-0 truncate">{t.titulo}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <PriorityBadge priority={t.prioridad as never} />
                    <TaskStatusBadge status={t.estado as never} />
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input placeholder="Nueva tarea para el contacto…" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
              <Button onClick={() => {
                if (taskTitle.trim().length < 3) return toast.error("Título muy corto.");
                start(async () => {
                  const res = await createTask({ titulo: taskTitle, contact_id: contact.id, contexto_operativo: "comunitario", prioridad: "media", estado: "pendiente", responsables: [], participantes: [] });
                  if (res.ok) { toast.success("Tarea creada."); setTaskTitle(""); router.refresh(); } else toast.error(res.message);
                });
              }}><Plus className="size-4" /></Button>
            </div>
          </CardContent>
        </Card>

        {/* Ciudadanos referidos */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold"><UserCheck className="size-4" /> Ciudadanos referidos</h3>
            <ul className="mb-3 space-y-1.5">
              {referidos.length === 0 && <li className="text-sm text-muted-foreground">Ninguno.</li>}
              {referidos.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                  <span className="min-w-0 truncate">{r.nombre} {r.apellido ?? ""}{r.localidad ? ` · ${r.localidad}` : ""}</span>
                  <button className="text-muted-foreground hover:text-destructive" onClick={() => start(async () => {
                    const res = await linkReferredCitizen(r.id, null);
                    if (res.ok) setReferidos((x) => x.filter((y) => y.id !== r.id)); else toast.error(res.message);
                  })}><X className="size-4" /></button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Select value={refPick} onValueChange={setRefPick}>
                <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Vincular ciudadano referido" /></SelectTrigger>
                <SelectContent>
                  {citizenCandidates.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Sin ciudadanos</div>}
                  {citizenCandidates.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre} {c.apellido ?? ""}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => {
                if (!refPick) return;
                start(async () => {
                  const res = await linkReferredCitizen(refPick, contact.id);
                  if (res.ok) {
                    const c = citizens.find((x) => x.id === refPick);
                    if (c) setReferidos((x) => [...x, c]);
                    setRefPick("");
                  } else toast.error(res.message);
                });
              }}><Plus className="size-4" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
