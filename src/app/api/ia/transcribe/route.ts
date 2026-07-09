import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Transcribe una nota de voz con Whisper (OpenAI). Requiere OPENAI_API_KEY. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "La transcripción requiere OPENAI_API_KEY." }, { status: 400 });
  }

  let audio: File | null = null;
  try {
    const form = await req.formData();
    audio = form.get("audio") as File | null;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!audio) return NextResponse.json({ error: "No se recibió audio" }, { status: 400 });

  try {
    const fd = new FormData();
    fd.append("file", audio, audio.name || "nota.webm");
    fd.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
    fd.append("language", "es");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json({ error: `Whisper respondió ${res.status}: ${detail.slice(0, 160)}` }, { status: 502 });
    }
    const data = (await res.json()) as { text?: string };
    return NextResponse.json({ texto: (data.text ?? "").trim() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error de transcripción" }, { status: 500 });
  }
}
