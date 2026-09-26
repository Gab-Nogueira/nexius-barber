// Browser-only preparation keeps phone photos small before they reach the server.
export async function uploadImage(file: File, description: string) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Escolha uma foto de até 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error('Não conseguimos abrir esta foto. Se ela estiver em HEIC, exporte como JPG ou escolha uma imagem PNG/WebP.'); });
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('Esta imagem é muito grande. Escolha uma versão menor.');
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a foto neste navegador.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Não foi possível preparar a imagem.')), 'image/webp', .86));
    const extension = blob.type === 'image/webp' ? 'webp' : 'png';
    const form = new FormData();
    form.set('file', new File([blob], `nexius-foto.${extension}`, { type: blob.type }));
    form.set('altText', description.trim().slice(0, 180) || 'Foto da Nexius Barber');
    const response = await fetch('/api/admin/upload', { method: 'POST', body: form });
    const result = await response.json().catch(() => ({})) as { id?: string; altText?: string; error?: string };
    if (!response.ok || !result.id) throw new Error(response.status === 401 ? 'Sua sessão expirou. Entre na gestão novamente para enviar a foto.' : result.error || 'Não foi possível enviar a foto. Tente novamente.');
    return { id: result.id, name: file.name, altText: result.altText || description };
  } finally {
    URL.revokeObjectURL(url);
  }
}
