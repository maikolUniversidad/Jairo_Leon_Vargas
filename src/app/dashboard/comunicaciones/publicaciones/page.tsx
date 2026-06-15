import { PageHeader } from "@/components/dashboard/shared";
import { PublicacionesManager } from "@/components/dashboard/publicaciones-manager";
import { listPosts } from "@/actions/contenido";

export default async function PublicacionesPage() {
  const posts = await listPosts();
  return (
    <>
      <PageHeader
        title="Publicaciones"
        description="Noticias, comunicados y piezas. Las públicas y publicadas se muestran en el sitio web."
      />
      <PublicacionesManager posts={posts} />
    </>
  );
}
