import Link from "next/link";
import { Facebook, Instagram, Youtube, LogIn } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t bg-secondary text-white/80">
      <div className="container grid gap-8 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 font-bold text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-black">
              JLV
            </span>
            Jairo León Vargas
          </div>
          <p className="mt-3 max-w-md text-sm">
            Gestión social, participación ciudadana y trabajo comunitario para
            Bogotá y Colombia. Este sitio prioriza hechos verificables y canales
            de atención ciudadana.
          </p>
          <div className="mt-4 flex gap-3">
            <a href="#" aria-label="Facebook" className="rounded-full bg-white/10 p-2 hover:bg-white/20">
              <Facebook className="size-4" />
            </a>
            <a href="#" aria-label="Instagram" className="rounded-full bg-white/10 p-2 hover:bg-white/20">
              <Instagram className="size-4" />
            </a>
            <a href="#" aria-label="YouTube" className="rounded-full bg-white/10 p-2 hover:bg-white/20">
              <Youtube className="size-4" />
            </a>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Participa</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/participa" className="hover:text-white">Cuéntanos tu necesidad</Link></li>
            <li><Link href="/solicitudes" className="hover:text-white">Radicar solicitud</Link></li>
            <li><Link href="/agenda" className="hover:text-white">Agenda en territorio</Link></li>
            <li><Link href="/noticias" className="hover:text-white">Noticias</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Legal</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/politica-datos" className="hover:text-white">Política de tratamiento de datos</Link></li>
            <li><Link href="/terminos" className="hover:text-white">Términos de uso</Link></li>
            <li><Link href="/transparencia" className="hover:text-white">Transparencia</Link></li>
            <li>
              <Link href="/login" className="inline-flex items-center gap-1 hover:text-white">
                <LogIn className="size-3.5" /> Ingreso equipo
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-white/60 md:flex-row">
          <p>© {new Date().getFullYear()} Jairo León Vargas. Todos los derechos reservados.</p>
          <p>Plataforma UTL 360 · Datos tratados conforme a la Ley 1581 de 2012.</p>
        </div>
      </div>
    </footer>
  );
}
