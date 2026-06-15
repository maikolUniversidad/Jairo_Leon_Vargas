"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Phone, Mail, MapPin, Building2, ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataView, type Column } from "@/components/dashboard/data-view";
import { ContactCreateDialog } from "@/components/dashboard/contact-create-dialog";
import { initials } from "@/lib/utils";
import { CONTACT_TIPO_LABELS, type Contact } from "@/types/database";

interface ZoneOpt { id: string; nombre_zona: string }

export function ContactosList({
  contacts,
  zones,
}: {
  contacts: Contact[];
  zones: ZoneOpt[];
}) {
  const [q, setQ] = useState("");
  const zoneName = useMemo(() => new Map(zones.map((z) => [z.id, z.nombre_zona])), [zones]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return contacts;
    return contacts.filter((c) =>
      [c.nombre, c.apellido, c.puesto, c.organizacion, c.localidad]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(s)),
    );
  }, [contacts, q]);

  const Avatar = (c: Contact) => (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-white">
      {c.foto_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.foto_url} alt="" className="size-full object-cover" />
      ) : initials(`${c.nombre} ${c.apellido ?? ""}`)}
    </span>
  );

  const columns: Column<Contact>[] = [
    {
      header: "Contacto",
      cell: (c) => (
        <Link href={`/dashboard/contactos/${c.id}`} className="flex items-center gap-3">
          {Avatar(c)}
          <span>
            <span className="font-medium">{c.nombre} {c.apellido ?? ""}</span>
            {c.puesto && <span className="block text-xs text-muted-foreground">{c.puesto}</span>}
          </span>
        </Link>
      ),
    },
    { header: "Tipo", cell: (c) => <Badge variant="muted">{CONTACT_TIPO_LABELS[c.tipo] ?? c.tipo}</Badge> },
    { header: "Organización", cell: (c) => c.organizacion ?? "—" },
    { header: "Zona", cell: (c) => (c.zona_id ? zoneName.get(c.zona_id) ?? "—" : c.localidad ?? "—") },
    { header: "Contacto", cell: (c) => c.whatsapp || c.telefono || c.email || "—", className: "text-sm" },
  ];

  const renderCard = (c: Contact) => (
    <Link href={`/dashboard/contactos/${c.id}`} className="block">
      <div className="flex items-start gap-3">
        {Avatar(c)}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{c.nombre} {c.apellido ?? ""}</p>
          {c.puesto && <p className="truncate text-xs text-muted-foreground">{c.puesto}</p>}
          <Badge variant="muted" className="mt-1">{CONTACT_TIPO_LABELS[c.tipo] ?? c.tipo}</Badge>
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
      </div>
      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
        {c.organizacion && <p className="flex items-center gap-2"><Building2 className="size-3.5" />{c.organizacion}</p>}
        {(c.whatsapp || c.telefono) && <p className="flex items-center gap-2"><Phone className="size-3.5" />{c.whatsapp || c.telefono}</p>}
        {c.email && <p className="flex items-center gap-2 truncate"><Mail className="size-3.5" />{c.email}</p>}
        {(c.zona_id || c.localidad) && (
          <p className="flex items-center gap-2"><MapPin className="size-3.5" />{(c.zona_id && zoneName.get(c.zona_id)) || c.localidad}</p>
        )}
      </div>
    </Link>
  );

  return (
    <DataView
      items={filtered}
      columns={columns}
      renderCard={renderCard}
      getKey={(c) => c.id}
      viewKey="contactos"
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <ContactCreateDialog zones={zones} />
          <Input
            placeholder="Buscar contacto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 w-56"
          />
        </div>
      }
      empty={<p className="py-10 text-center text-sm text-muted-foreground">Sin contactos. Crea el primero.</p>}
    />
  );
}
