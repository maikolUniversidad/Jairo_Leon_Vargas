"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Table as TableIcon, IdCard } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ViewMode = "table" | "cards";

export interface Column<T> {
  header: string;
  cell: (item: T) => ReactNode;
  className?: string;
}

/**
 * Vista de datos conmutable: tabla o vCard (tarjetas).
 * Por defecto, en móvil arranca como tarjetas y en escritorio como tabla;
 * el usuario puede cambiarlo y la preferencia se recuerda (localStorage).
 */
export function DataView<T>({
  items,
  columns,
  renderCard,
  getKey,
  viewKey,
  empty,
  toolbar,
}: {
  items: T[];
  columns: Column<T>[];
  renderCard: (item: T) => ReactNode;
  getKey: (item: T) => string;
  viewKey: string;
  empty?: ReactNode;
  toolbar?: ReactNode;
}) {
  const [mode, setMode] = useState<ViewMode>("table");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`view:${viewKey}`) as ViewMode | null;
    if (saved === "table" || saved === "cards") setMode(saved);
    else setMode(window.matchMedia("(max-width: 639px)").matches ? "cards" : "table");
    setMounted(true);
  }, [viewKey]);

  function choose(m: ViewMode) {
    setMode(m);
    localStorage.setItem(`view:${viewKey}`, m);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">{toolbar}</div>
        <div className="flex shrink-0 items-center rounded-lg border p-0.5">
          <button
            type="button"
            onClick={() => choose("table")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
            aria-label="Ver como tabla"
          >
            <TableIcon className="size-3.5" /> Tabla
          </button>
          <button
            type="button"
            onClick={() => choose("cards")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
            aria-label="Ver como tarjetas"
          >
            <IdCard className="size-3.5" /> vCard
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div>{empty ?? <p className="py-8 text-center text-sm text-muted-foreground">Sin registros.</p>}</div>
      ) : !mounted ? (
        <TableRender items={items} columns={columns} getKey={getKey} />
      ) : mode === "table" ? (
        <TableRender items={items} columns={columns} getKey={getKey} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <Card key={getKey(it)} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">{renderCard(it)}</CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TableRender<T>({
  items, columns, getKey,
}: {
  items: T[];
  columns: Column<T>[];
  getKey: (item: T) => string;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.header} className={c.className}>{c.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={getKey(it)}>
                {columns.map((c) => (
                  <TableCell key={c.header} className={c.className}>{c.cell(it)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
