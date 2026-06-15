"use client";

import { useMemo, useState } from "react";
import { Phone, Mail, MapPin, UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataView, type Column } from "@/components/dashboard/data-view";
import { formatDate, initials } from "@/lib/utils";
import type { Citizen } from "@/types/database";

export function CiudadanosList({
  citizens,
  referrerById,
}: {
  citizens: Citizen[];
  referrerById: Record<string, string>;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return citizens;
    return citizens.filter((c) =>
      [c.nombre, c.apellido, c.localidad, c.barrio, c.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(s)),
    );
  }, [citizens, q]);

  const columns: Column<Citizen>[] = [
    {
      header: "Nombre",
      cell: (c) => (
        <span className="font-medium">{c.nombre} {c.apellido ?? ""}</span>
      ),
    },
    { header: "Localidad", cell: (c) => (c.localidad ?? "—") + (c.barrio ? ` · ${c.barrio}` : "") },
    { header: "Contacto", cell: (c) => c.whatsapp || c.telefono || c.email || "—", className: "text-sm" },
    {
      header: "Referido por",
      cell: (c) => (c.referido_por_contact_id ? (referrerById[c.referido_por_contact_id] ?? "—") : "—"),
    },
    { header: "Estado", cell: (c) => <Badge variant="muted">{c.estado}</Badge> },
    { header: "Registrado", cell: (c) => <span className="text-sm text-muted-foreground">{formatDate(c.created_at)}</span> },
  ];

  const renderCard = (c: Citizen) => (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-white">
          {initials(`${c.nombre} ${c.apellido ?? ""}`)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">{c.nombre} {c.apellido ?? ""}</p>
          <Badge variant="muted" className="mt-0.5">{c.estado}</Badge>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
        {(c.whatsapp || c.telefono) && <p className="flex items-center gap-2"><Phone className="size-3.5" />{c.whatsapp || c.telefono}</p>}
        {c.email && <p className="flex items-center gap-2 truncate"><Mail className="size-3.5" />{c.email}</p>}
        {(c.localidad || c.barrio) && <p className="flex items-center gap-2"><MapPin className="size-3.5" />{c.localidad}{c.barrio ? ` · ${c.barrio}` : ""}</p>}
        {c.referido_por_contact_id && (
          <p className="flex items-center gap-2"><UserCheck className="size-3.5" />Referido por {referrerById[c.referido_por_contact_id] ?? "—"}</p>
        )}
      </div>
    </div>
  );

  return (
    <DataView
      items={filtered}
      columns={columns}
      renderCard={renderCard}
      getKey={(c) => c.id}
      viewKey="ciudadanos"
      toolbar={
        <Input placeholder="Buscar ciudadano…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-56" />
      }
      empty={<p className="py-10 text-center text-sm text-muted-foreground">Sin ciudadanos registrados.</p>}
    />
  );
}
