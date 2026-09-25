import { ApiError, database, filesBucket, jsonError } from '@/lib/nexius';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const metadata = await database().prepare('SELECT object_key as objectKey, content_type as contentType FROM media_files WHERE id = ?')
      .bind(id).first<{ objectKey: string; contentType: string }>();
    if (!metadata) throw new ApiError(404, 'Imagem não encontrada.', 'media_not_found');
    const object = await filesBucket().get(metadata.objectKey);
    if (!object) throw new ApiError(404, 'Arquivo não encontrado.', 'media_file_missing');
    return new Response(object.body, { headers: { 'Content-Type': metadata.contentType, 'Cache-Control': 'public, max-age=3600' } });
  } catch (error) {
    return jsonError(error);
  }
}
