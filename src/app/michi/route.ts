import { redirect } from "next/navigation";

export function GET() {
  redirect("https://michi.movimientopactohistorico.co/register?tipomembresia=militancia&tiporegistro=membresia");
}
