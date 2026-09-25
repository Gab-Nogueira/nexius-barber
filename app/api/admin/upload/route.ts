import { requireAdmin } from '@/lib/authz';
import { ApiError, database, filesBucket, jsonError } from '@/lib/nexius';
import { assertSameOrigin } from '@/lib/transactions';

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const access = await requireAdmin();
    const data = await request.formData();
    const file = data.get('file');
    const altValue = data.get('altText');
    const altText = typeof altValue === 'string' ? altValue.trim() : '';
    if (!(file instanceof File)) throw new ApiError(400, 'Escolha uma imagem.', 'file_missing');
    if (!ACCEPTED_TYPES.has(file.type)) throw new ApiError(400, 'Use JPG, PNG ou WebP.', 'file_type_invalid');
    if (file.size <= 0 || file.size > MAX_SIZE) throw new ApiError(400, 'A imagem deve ter até 5 MB.', 'file_size_invalid');
    if (altText.length < 3 || altText.length > 180) throw new ApiError(400, 'Descreva a imagem para acessibilidade.', 'alt_text_invalid');
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const matches = file.type === 'image/png' ? [137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value) : file.type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP';
    if (!matches) throw new ApiError(400, 'O conteúdo do arquivo não corresponde ao tipo da imagem.', 'file_signature_invalid');
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const id = crypto.randomUUID();
    const objectKey = `content/${id}.${extension}`;
    await filesBucket().put(objectKey, file.stream(), { httpMetadata: { contentType: file.type } });
    const now = new Date().toISOString();
    try {
      await database().prepare(`INSERT INTO media_files
        (id, object_key, original_name, content_type, size_bytes, alt_text, uploaded_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, objectKey, file.name.slice(0, 180), file.type, file.size, altText, access.user.userId, now).run();
    } catch (error) {
      await filesBucket().delete(objectKey);
      throw error;
    }
    return Response.json({ id, url: `/api/media/${id}`, altText }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
