import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageIntro } from "@/components/landing/page-intro";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { ContentPost } from "@/types/database";

export const metadata: Metadata = {
  title: "Noticias y comunicados",
  description: "Publicaciones, comunicados y novedades.",
};

async function getPublicPosts(): Promise<ContentPost[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("content_posts")
      .select("*")
      .eq("visibilidad", "publica")
      .eq("estado", "publicado")
      .is("deleted_at", null)
      .order("fecha_publicacion", { ascending: false })
      .limit(30);
    return (data as ContentPost[]) ?? [];
  } catch {
    return [];
  }
}

export default async function NoticiasPage() {
  const posts = await getPublicPosts();

  return (
    <div className="container py-12 md:py-16">
      <PageIntro
        eyebrow="Novedades"
        title="Noticias y comunicados"
        description="Lo último del trabajo en el territorio."
      />

      {posts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
            <Newspaper className="size-10 opacity-40" />
            <p>Aún no hay publicaciones.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Card key={post.id} className="group overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              {post.imagen_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.imagen_url} alt={post.titulo} className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              )}
              <CardContent className="p-5">
                {post.categoria && <Badge variant="muted" className="mb-2">{post.categoria}</Badge>}
                <h3 className="font-bold leading-snug">{post.titulo}</h3>
                {post.resumen && (
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{post.resumen}</p>
                )}
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDate(post.fecha_publicacion)}</span>
                  {post.slug && (
                    <Link href={`/noticias/${post.slug}`} className="font-medium text-primary hover:underline">
                      Leer más →
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
