import { database } from './nexius';

export const CONTENT_DEFAULTS: Record<string, string> = {
  business_address:
    'Avenida das Rosas, 341, Jardim Motorama, São José dos Campos — SP',
  business_phone: '(12) 98814-9114',
  instagram_url: 'https://www.instagram.com/nexius_barber/',
  slogan: 'Não é só corte, é conexão',
  about_text:
    'A Nexius Barber inicia uma nova fase com uma experiência própria: da descoberta ao agendamento, tudo em um só lugar.',
  hero_text:
    'Uma nova experiência de cuidado, presença e estilo. Escolha seu serviço, encontre o melhor horário e confirme em poucos passos.',
};
export async function publicContent() {
  const [rows, media] = await Promise.all([
    database()
      .prepare('SELECT key,value FROM content_entries')
      .all<{ key: string; value: string }>(),
    database()
      .prepare('SELECT id,alt_text as altText FROM media_files')
      .all<{ id: string; altText: string }>(),
  ]);
  const values = {
    ...CONTENT_DEFAULTS,
    ...Object.fromEntries(
      rows.results
        .filter((item) => item.value)
        .map((item) => [item.key, item.value]),
    ),
  };
  const gallery = (key: string) =>
    (values[key] || '')
      .split(',')
      .map((id) => media.results.find((item) => item.id === id.trim()))
      .filter((item): item is { id: string; altText: string } => !!item);
  const image = (key: string) =>
    media.results.find((item) => item.id === values[key]);
  return {
    values,
    gallery: gallery('gallery_images'),
    environment: gallery('environment_images'),
    hero: image('hero_image'),
    logo: image('logo_image'),
  };
}
