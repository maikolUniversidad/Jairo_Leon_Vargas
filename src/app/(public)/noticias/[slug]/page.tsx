import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { ContentPost } from "@/types/database";

async function getPost(slug: string): Promise<ContentPost | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("content_posts")
      .select("*")
      .eq("slug", slug)
      .eq("visibilidad", "publica")
      .eq("estado", "publicado")
      .maybeSingle();
    return (data as ContentPost) ?? null;
  } catch {
    return null;
  }
}

export default async function NoticiaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <article className="container max-w-2xl py-12 md:py-16">
      <Link href="/noticias" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Volver a noticias
      </Link>
      {post.categoria && <Badge variant="muted" className="mb-3">{post.categoria}</Badge>}
      <h1 className="text-3xl font-bold leading-tight md:text-4xl">{post.titulo}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{formatDate(post.fecha_publicacion)}</p>
      {post.imagen_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imagen_url} alt={post.titulo} className="mt-6 w-full rounded-2xl object-cover" />
      )}
      {post.resumen && <p className="mt-6 text-lg text-muted-foreground">{post.resumen}</p>}
      {post.cuerpo && (
        <div className="prose mt-6 max-w-none whitespace-pre-wrap text-foreground">
          {post.cuerpo}
        </div>
      )}
    </article>
  );
}
