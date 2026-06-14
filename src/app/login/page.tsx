"use client";

import { Suspense, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { signIn } from "@/actions/auth";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectTo") ?? "/dashboard";
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((values) =>
        start(async () => {
          const res = await signIn(values);
          if (res.ok) {
            toast.success("Bienvenido/a");
            router.replace(redirectTo);
            router.refresh();
          } else {
            toast.error(res.message);
          }
        }),
      )}
    >
      <div>
        <Label htmlFor="email">Correo</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {formState.errors.email && (
          <p className="mt-1 text-xs text-destructive">{formState.errors.email.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
        {formState.errors.password && (
          <p className="mt-1 text-xs text-destructive">{formState.errors.password.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-marca-hero p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-white/80 hover:text-white">
          <ArrowLeft className="size-4" /> Volver al sitio
        </Link>
        <Card>
          <CardContent className="p-8">
            <div className="mb-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-black text-white">
                JLV
              </span>
              <h1 className="mt-3 text-xl font-bold">Ingreso del equipo</h1>
              <p className="text-sm text-muted-foreground">Plataforma UTL 360</p>
            </div>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Acceso restringido. Las credenciales las gestiona el administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
