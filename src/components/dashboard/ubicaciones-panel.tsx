"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  MapPin,
  Navigation,
  Send,
  Trash2,
  Crosshair,
  Users,
  Radar,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/dashboard/shared";
import { LiveMap, type MapPerson, type MapDestination } from "@/components/dashboard/live-map";
import {
  LOCATION_TOGGLE_EVENT,
  LOCATION_STATE_EVENT,
} from "@/components/dashboard/location-tracker";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import {
  DIRECTIVE_STATUS_LABELS,
  type UserLocation,
  type LocationDirective,
  type DirectiveStatus,
  type Profile,
} from "@/types/database";
import {
  createDirective,
  updateDirectiveStatus,
  deleteDirective,
  getUserTrail,
} from "@/actions/ubicaciones";

type Persona = Pick<Profile, "id" | "full_name" | "email">;

export function UbicacionesPanel({
  canCoordinate,
  currentUserId,
  mySharing,
  locations,
  directives,
  profiles,
}: {
  canCoordinate: boolean;
  currentUserId: string;
  mySharing: boolean;
  locations: UserLocation[];
  directives: LocationDirective[];
  profiles: Persona[];
}) {
  const [sharing, setSharing] = useState(mySharing);
  const [locs, setLocs] = useState<UserLocation[]>(locations);
  const [dirs, setDirs] = useState<LocationDirective[]>(directives);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [trailOf, setTrailOf] = useState<string | null>(null);
  const [, start] = useTransition();

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.full_name ?? p.email ?? "—");
    return m;
  }, [profiles]);

  // Sincroniza el botón con el tracker (que vive en el layout).
  useEffect(() => {
    const handler = (e: Event) => setSharing((e as CustomEvent<boolean>).detail);
    window.addEventListener(LOCATION_STATE_EVENT, handler);
    return () => window.removeEventListener(LOCATION_STATE_EVENT, handler);
  }, []);

  // Realtime: posiciones e indicaciones en vivo.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("ubicaciones-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_locations" },
        (payload) => {
          setLocs((prev) => {
            if (payload.eventType === "DELETE") {
              const old = payload.old as UserLocation;
              return prev.filter((l) => l.user_id !== old.user_id);
            }
            const row = payload.new as UserLocation;
            const rest = prev.filter((l) => l.user_id !== row.user_id);
            return [...rest, row];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "location_directives" },
        async () => {
          const { data } = await supabase
            .from("location_directives")
            .select("*")
            .order("created_at", { ascending: false });
          if (data) setDirs(data as LocationDirective[]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  function toggleSharing() {
    const next = !sharing;
    setSharing(next);
    window.dispatchEvent(new CustomEvent(LOCATION_TOGGLE_EVENT, { detail: next }));
  }

  function showTrail(userId: string) {
    if (trailOf === userId) { setTrail([]); setTrailOf(null); return; }
    start(async () => {
      const pts = await getUserTrail(userId);
      setTrail(pts.map((p) => [p.lat, p.lng] as [number, number]));
      setTrailOf(userId);
      if (pts.length < 2) toast.message("Aún no hay recorrido registrado para esta persona.");
    });
  }

  const people: MapPerson[] = locs
    .filter((l) => l.is_sharing && l.lat != null && l.lng != null)
    .map((l) => ({
      id: l.user_id,
      name: nameById.get(l.user_id) ?? "Usuario",
      lat: l.lat as number,
      lng: l.lng as number,
      updated_at: l.updated_at,
    }));

  const activeDestinations: MapDestination[] = dirs
    .filter((d) => d.destino_lat != null && d.destino_lng != null && d.estado !== "cancelada" && d.estado !== "llego")
    .map((d) => ({
      id: d.id,
      label: `${nameById.get(d.user_id) ?? "—"} · ${d.destino_nombre ?? d.titulo}`,
      lat: d.destino_lat as number,
      lng: d.destino_lng as number,
    }));

  const myDirectives = dirs.filter((d) => d.user_id === currentUserId);

  return (
    <div className="space-y-6">
      {/* Mi estado de ubicación */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 flex size-9 items-center justify-center rounded-xl ${sharing ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
              <MapPin className="size-5" />
            </span>
            <div>
              <p className="font-semibold">
                {sharing ? "Estás compartiendo tu ubicación" : "Tu ubicación está oculta"}
              </p>
              <p className="text-sm text-muted-foreground">
                {sharing
                  ? "El equipo de coordinación puede ver dónde estás mientras esta ventana siga abierta."
                  : "Actívalo para que coordinación sepa dónde estás. Tú controlas cuándo."}
              </p>
            </div>
          </div>
          <Button onClick={toggleSharing} variant={sharing ? "outline" : "default"}>
            <Navigation className="size-4" />
            {sharing ? "Dejar de compartir" : "Compartir mi ubicación"}
          </Button>
        </CardContent>
      </Card>

      {/* Mis indicaciones (para cualquier usuario) */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Navigation className="size-5" /> Mis indicaciones
        </h2>
        {myDirectives.length === 0 ? (
          <EmptyState icon={Navigation} title="Sin indicaciones" description="Cuando coordinación te asigne un destino, aparecerá aquí." />
        ) : (
          <div className="space-y-2">
            {myDirectives.map((d) => (
              <Card key={d.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{d.titulo}</p>
                    {d.destino_nombre && (
                      <p className="text-sm text-muted-foreground">📍 {d.destino_nombre}</p>
                    )}
                    {d.descripcion && <p className="text-sm text-muted-foreground">{d.descripcion}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(d.created_at, { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge estado={d.estado} />
                    {d.estado !== "llego" && d.estado !== "cancelada" && (
                      <>
                        {d.estado === "pendiente" && (
                          <Button size="sm" variant="outline" onClick={() => changeStatus(d.id, "en_camino", start, setDirs)}>
                            Voy en camino
                          </Button>
                        )}
                        <Button size="sm" onClick={() => changeStatus(d.id, "llego", start, setDirs)}>
                          Ya llegué
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Vista de coordinación */}
      {canCoordinate && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Radar className="size-5" /> Mapa en vivo
              <Badge variant="muted" className="gap-1">
                <Users className="size-3" /> {people.length} en línea
              </Badge>
            </h2>
            <LiveMap people={people} destinations={activeDestinations} trail={trail} />
            {people.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nadie está compartiendo ubicación en este momento.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {people.map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={trailOf === p.id ? "default" : "outline"}
                    onClick={() => showTrail(p.id)}
                  >
                    <Navigation className="size-3.5" /> {p.name}
                    <span className="text-xs opacity-70">{trailOf === p.id ? "· ocultar" : "· recorrido"}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-6">
            <DirectiveComposer profiles={profiles} setDirs={setDirs} />
            <CoordinatorDirectives dirs={dirs} nameById={nameById} setDirs={setDirs} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ estado }: { estado: DirectiveStatus }) {
  const variant =
    estado === "llego" ? "success" : estado === "cancelada" ? "muted" : estado === "en_camino" ? "warning" : "secondary";
  return <Badge variant={variant}>{DIRECTIVE_STATUS_LABELS[estado]}</Badge>;
}

function changeStatus(
  id: string,
  estado: DirectiveStatus,
  start: React.TransitionStartFunction,
  setDirs: React.Dispatch<React.SetStateAction<LocationDirective[]>>,
) {
  setDirs((prev) => prev.map((d) => (d.id === id ? { ...d, estado } : d)));
  start(async () => {
    const res = await updateDirectiveStatus(id, estado);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  });
}

/* ─────────────── Crear indicación (coordinación) ─────────────── */

function DirectiveComposer({
  profiles,
  setDirs,
}: {
  profiles: Persona[];
  setDirs: React.Dispatch<React.SetStateAction<LocationDirective[]>>;
}) {
  const [userId, setUserId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [destinoNombre, setDestinoNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    if (!userId) return toast.error("Selecciona a una persona.");
    if (titulo.trim().length < 2) return toast.error("Escribe la indicación.");
    start(async () => {
      const res = await createDirective({
        user_id: userId,
        titulo: titulo.trim(),
        descripcion,
        destino_nombre: destinoNombre,
        destino_lat: coords?.lat,
        destino_lng: coords?.lng,
      });
      if (res.ok) {
        toast.success(res.message);
        setTitulo(""); setDestinoNombre(""); setDescripcion(""); setCoords(null); setPickMode(false);
        const supabase = createClient();
        const { data } = await supabase.from("location_directives").select("*").order("created_at", { ascending: false });
        if (data) setDirs(data as LocationDirective[]);
      } else toast.error(res.message);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Send className="size-4" /> Dejar una indicación
        </h3>
        <div>
          <Label>Persona</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue placeholder="¿A quién?" /></SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="dir-titulo">Indicación</Label>
          <Input id="dir-titulo" placeholder="Ir al punto de encuentro…" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="dir-dest">Lugar de destino</Label>
          <Input id="dir-dest" placeholder="Parque Principal, barrio…" value={destinoNombre} onChange={(e) => setDestinoNombre(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="dir-desc">Detalles (opcional)</Label>
          <Textarea id="dir-desc" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Button type="button" variant={pickMode ? "default" : "outline"} size="sm" onClick={() => setPickMode((v) => !v)}>
            <Crosshair className="size-4" /> {pickMode ? "Haz clic en el mapa…" : "Fijar destino en el mapa"}
          </Button>
          {coords && (
            <p className="text-xs text-muted-foreground">
              Destino: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          )}
        </div>
        {/* Mini-mapa para fijar el destino */}
        {pickMode && (
          <LiveMap
            people={[]}
            destinations={coords ? [{ id: "tmp", label: "Destino", lat: coords.lat, lng: coords.lng }] : []}
            pickMode
            onPick={(lat, lng) => setCoords({ lat, lng })}
          />
        )}
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Enviando…" : "Enviar indicación"}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─────────────── Lista de indicaciones (coordinación) ─────────────── */

function CoordinatorDirectives({
  dirs,
  nameById,
  setDirs,
}: {
  dirs: LocationDirective[];
  nameById: Map<string, string>;
  setDirs: React.Dispatch<React.SetStateAction<LocationDirective[]>>;
}) {
  const [, start] = useTransition();
  const active = dirs.filter((d) => d.estado !== "cancelada" && d.estado !== "llego");

  function remove(id: string) {
    if (!confirm("¿Eliminar esta indicación?")) return;
    start(async () => {
      const res = await deleteDirective(id);
      if (res.ok) { toast.success(res.message); setDirs((prev) => prev.filter((d) => d.id !== id)); }
      else toast.error(res.message);
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="mb-3 font-semibold">Indicaciones activas ({active.length})</h3>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay indicaciones activas.</p>
        ) : (
          <ul className="space-y-2">
            {active.map((d) => (
              <li key={d.id} className="rounded-lg border p-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{nameById.get(d.user_id) ?? "—"}</p>
                    <p className="text-muted-foreground">{d.titulo}{d.destino_nombre ? ` · ${d.destino_nombre}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <StatusBadge estado={d.estado} />
                    <button aria-label="Eliminar" onClick={() => remove(d.id)} className="rounded p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
