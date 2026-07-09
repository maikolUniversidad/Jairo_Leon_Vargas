"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth";
import {
  CONNECTION_PROVIDERS,
  getConnectionsStatus,
  getConnectionSecret,
  saveConnectionSecret,
  deleteConnectionSecret,
  testConnection,
  clearConnectionStatus,
  type ConnectionStatus,
  type ProviderDef,
} from "@/lib/connections";
import { type ActionResult } from "./types";

const MANAGER_ROLES = ["direccion_general", "coordinador_utl", "comunicaciones"] as const;

async function assertManager(): Promise<boolean> {
  const u = await getSessionUser();
  return !!u && (u.isAdmin || u.roles.some((r) => (MANAGER_ROLES as readonly string[]).includes(r)));
}

export interface ConnectionView {
  provider: ProviderDef;
  status: ConnectionStatus;
  hasSecret: boolean;
}

/** Lista los proveedores con su estado (sin exponer las credenciales). */
export async function listConnections(): Promise<ConnectionView[]> {
  if (!(await assertManager())) return [];
  const status = await getConnectionsStatus();
  const views = await Promise.all(
    CONNECTION_PROVIDERS.map(async (provider) => {
      const secret = await getConnectionSecret(provider.key);
      const hasSecret = !!secret && Object.values(secret).some((v) => Boolean(v));
      return {
        provider,
        status: status[provider.key] ?? { connected: false },
        hasSecret,
      };
    }),
  );
  return views;
}

/** Guarda la credencial de un proveedor y prueba la conexión de inmediato. */
export async function saveConnection(
  providerKey: string,
  fields: Record<string, string>,
): Promise<ActionResult<{ status: ConnectionStatus }>> {
  if (!(await assertManager())) return { ok: false, message: "No autorizado." };
  const def = CONNECTION_PROVIDERS.find((p) => p.key === providerKey);
  if (!def) return { ok: false, message: "Proveedor desconocido." };

  const clean: Record<string, string> = {};
  for (const f of def.fields) clean[f.name] = (fields[f.name] ?? "").trim();
  if (def.fields.every((f) => !clean[f.name])) {
    return { ok: false, message: "Ingresa la credencial." };
  }

  await saveConnectionSecret(providerKey, clean);
  const status = await testConnection(providerKey);
  revalidatePath("/dashboard/configuracion");
  return {
    ok: true,
    message: status.connected
      ? `${def.label}: conexión confirmada.`
      : `Guardado, pero la verificación falló: ${status.detail ?? ""}`,
    data: { status },
  };
}

/** Vuelve a probar la conexión de un proveedor ya guardado. */
export async function checkConnection(
  providerKey: string,
): Promise<ActionResult<{ status: ConnectionStatus }>> {
  if (!(await assertManager())) return { ok: false, message: "No autorizado." };
  const status = await testConnection(providerKey);
  revalidatePath("/dashboard/configuracion");
  return {
    ok: status.connected,
    message: status.connected ? "Conexión confirmada." : `Sin conexión: ${status.detail ?? ""}`,
    data: { status },
  };
}

export async function disconnectConnection(providerKey: string): Promise<ActionResult> {
  if (!(await assertManager())) return { ok: false, message: "No autorizado." };
  await deleteConnectionSecret(providerKey);
  await clearConnectionStatus(providerKey);
  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Conexión eliminada." };
}
