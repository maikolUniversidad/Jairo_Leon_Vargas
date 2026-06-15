import "server-only";
import { Readable } from "node:stream";
import { google, type drive_v3 } from "googleapis";

import { createAdminClient } from "@/lib/supabase/admin";
import { DRIVE_TREE, type DriveConfig } from "@/lib/drive-shared";

const ROOT_NAME = "UTL 360";
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function getOAuthClient(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  );
}

export function getAuthUrl(redirectUri: string): string {
  return getOAuthClient(redirectUri).generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

/* ─────────── Persistencia (refresh token en app_secrets; config en settings) ─────────── */

async function saveRefreshToken(token: string, email: string | null) {
  const admin = createAdminClient();
  await admin.from("app_secrets").upsert({
    key: "google_drive",
    value: { refresh_token: token, email },
    updated_at: new Date().toISOString(),
  });
}

async function getRefreshToken(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("app_secrets").select("value").eq("key", "google_drive").maybeSingle();
  return (data?.value as { refresh_token?: string } | null)?.refresh_token ?? null;
}

export async function getDriveConfig(): Promise<DriveConfig> {
  const admin = createAdminClient();
  const { data } = await admin.from("settings").select("value").eq("key", "google_drive").maybeSingle();
  return (data?.value as DriveConfig) ?? { connected: false };
}

async function saveDriveConfig(cfg: DriveConfig) {
  const admin = createAdminClient();
  await admin.from("settings").update({ value: cfg, updated_at: new Date().toISOString() }).eq("key", "google_drive");
}

export async function disconnectDrive() {
  const admin = createAdminClient();
  await admin.from("app_secrets").delete().eq("key", "google_drive");
  await saveDriveConfig({ connected: false });
}

/* ─────────── Cliente Drive autenticado ─────────── */

export async function getDrive(redirectUri = "http://localhost"): Promise<drive_v3.Drive | null> {
  const token = await getRefreshToken();
  if (!token) return null;
  const client = getOAuthClient(redirectUri);
  client.setCredentials({ refresh_token: token });
  return google.drive({ version: "v3", auth: client });
}

/* ─────────── Conexión: intercambia código, guarda token, crea árbol ─────────── */

export async function handleOAuthCallback(code: string, redirectUri: string): Promise<DriveConfig> {
  const client = getOAuthClient(redirectUri);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google no devolvió refresh_token. Revoca el acceso y reconecta.");
  }
  client.setCredentials(tokens);

  let email: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    email = me.data.email ?? null;
  } catch {
    /* opcional */
  }

  await saveRefreshToken(tokens.refresh_token, email);

  const drive = google.drive({ version: "v3", auth: client });
  const cfg = await ensureFolderTree(drive, email);
  return cfg;
}

async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string,
): Promise<string> {
  const safe = name.replace(/'/g, "\\'");
  const q =
    `mimeType='application/vnd.google-apps.folder' and name='${safe}' and trashed=false` +
    (parentId ? ` and '${parentId}' in parents` : "");
  const list = await drive.files.list({ q, fields: "files(id,name)", spaces: "drive" });
  const found = list.data.files?.[0]?.id;
  if (found) return found;
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  return created.data.id!;
}

/** Crea (o repara) la carpeta raíz "UTL 360" y su árbol de subcarpetas. */
export async function ensureFolderTree(
  drive: drive_v3.Drive,
  email: string | null,
): Promise<DriveConfig> {
  const rootId = await findOrCreateFolder(drive, ROOT_NAME);
  const folders: Record<string, string> = {};
  for (const f of DRIVE_TREE) {
    folders[f.key] = await findOrCreateFolder(drive, f.name, rootId);
  }
  const cfg: DriveConfig = {
    connected: true,
    email: email ?? undefined,
    root_folder_id: rootId,
    root_link: `https://drive.google.com/drive/folders/${rootId}`,
    folders,
    connected_at: new Date().toISOString(),
  };
  await saveDriveConfig(cfg);
  return cfg;
}

/** Sube un buffer a una subcarpeta del proyecto y devuelve el enlace de Drive. */
export async function uploadBufferToDrive(opts: {
  folderKey: string;
  name: string;
  mime: string;
  buffer: Buffer;
}): Promise<{ id: string; link: string } | null> {
  const drive = await getDrive();
  if (!drive) return null;
  const cfg = await getDriveConfig();
  const folderId = cfg.folders?.[opts.folderKey] ?? cfg.root_folder_id;
  if (!folderId) return null;

  const created = await drive.files.create({
    requestBody: { name: opts.name, parents: [folderId] },
    media: { mimeType: opts.mime || "application/octet-stream", body: Readable.from(opts.buffer) },
    fields: "id, webViewLink",
  });
  const id = created.data.id!;
  // Enlace visible para cualquiera con el enlace (igual que los buckets públicos actuales)
  try {
    await drive.permissions.create({ fileId: id, requestBody: { role: "reader", type: "anyone" } });
  } catch {
    /* si falla el permiso, el enlace seguirá disponible para la cuenta */
  }
  const link = created.data.webViewLink ?? `https://drive.google.com/file/d/${id}/view`;
  return { id, link };
}
