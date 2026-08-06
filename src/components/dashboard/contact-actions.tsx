"use client";

import { MessageCircle, Mail, Phone, Pencil, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { mailtoUrl, telUrl, whatsappUrl, sitioWebUrl } from "@/lib/contacto-acciones";
import type { Contact } from "@/types/database";

/**
 * Botones de gestión de un contacto: WhatsApp, correo, llamar y editar.
 *
 * Cada botón aparece solo si el dato existe y es utilizable. Un contacto sin
 * teléfono ni correo simplemente muestra "Editar" — nunca se ve un botón
 * muerto que no lleva a ninguna parte.
 */
export function ContactActions({
  contact,
  onEdit,
}: {
  contact: Contact;
  onEdit: () => void;
}) {
  const nombre = contact.nombre.split(" ")[0];
  const saludo = `Hola ${nombre}, te escribo desde la UTL de Jairo León Vargas.`;

  // WhatsApp cae al teléfono si no hay número de WhatsApp propio.
  const wa = whatsappUrl(contact.whatsapp || contact.telefono, saludo);
  const waAlterno = whatsappUrl(contact.telefono_2, saludo);

  const mail = mailtoUrl(contact.email, { cuerpo: `${saludo}\n\n` });
  const mailAlterno = mailtoUrl(contact.email_2, { cuerpo: `${saludo}\n\n` });

  const tel = telUrl(contact.telefono || contact.whatsapp);
  const web = sitioWebUrl(contact.sitio_web);

  return (
    <div className="flex flex-wrap gap-2">
      {wa && (
        <Button asChild size="sm" className="bg-[#25D366] text-white hover:bg-[#1eb955]">
          <a href={wa} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        </Button>
      )}
      {waAlterno && !wa && (
        <Button asChild size="sm" className="bg-[#25D366] text-white hover:bg-[#1eb955]">
          <a href={waAlterno} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        </Button>
      )}

      {mail && (
        <Button asChild size="sm" variant="outline">
          <a href={mail}><Mail className="size-4" /> Enviar correo</a>
        </Button>
      )}
      {mailAlterno && !mail && (
        <Button asChild size="sm" variant="outline">
          <a href={mailAlterno}><Mail className="size-4" /> Enviar correo</a>
        </Button>
      )}

      {tel && (
        <Button asChild size="sm" variant="outline">
          <a href={tel}><Phone className="size-4" /> Llamar</a>
        </Button>
      )}

      {web && (
        <Button asChild size="sm" variant="outline">
          <a href={web} target="_blank" rel="noopener noreferrer">
            <Globe className="size-4" /> Sitio web
          </a>
        </Button>
      )}

      <Button size="sm" variant="secondary" onClick={onEdit}>
        <Pencil className="size-4" /> Editar
      </Button>
    </div>
  );
}
