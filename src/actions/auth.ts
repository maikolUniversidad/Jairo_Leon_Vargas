"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations";
import { type ActionResult, zodToFieldErrors } from "./types";

export async function signIn(raw: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Credenciales inválidas.",
      fieldErrors: zodToFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, message: "Correo o contraseña incorrectos." };
  }

  try {
    await supabase.from("activity_log").insert({
      user_id: data.user?.id ?? null,
      accion: "login",
      detalle: "Inicio de sesión",
    });
  } catch {
    /* best-effort */
  }

  return { ok: true, message: "Sesión iniciada." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
