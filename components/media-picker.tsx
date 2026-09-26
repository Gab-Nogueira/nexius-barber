'use client';

import { useId, useRef, useState } from 'react';
import { Check, ImagePlus, LoaderCircle } from 'lucide-react';
import { uploadImage } from '@/lib/image-upload';

export type MediaOption = { id: string; name: string; altText: string };

export function MediaPicker({ media, value, onChange, label = 'Foto', onBusyChange, onUploaded, library = true }: {
  media: MediaOption[]; value: string; onChange: (id: string) => void; label?: string;
  onBusyChange?: (busy: boolean) => void; onUploaded?: (item: MediaOption) => void; library?: boolean;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [extra, setExtra] = useState<MediaOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const options = [...media, ...extra.filter((item) => !media.some((saved) => saved.id === item.id))];
  const selected = options.find((item) => item.id === value);
  async function send(file?: File) {
    if (!file || busy) return;
    setBusy(true); setError(''); setSuccess(false); onBusyChange?.(true);
    try {
      const saved = await uploadImage(file, label);
      setExtra((items) => [...items, saved]); onUploaded?.(saved); onChange(saved.id); setSuccess(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Falha no envio. Tente novamente.'); }
    finally { setBusy(false); onBusyChange?.(false); if (input.current) input.current.value = ''; }
  }
  return <div className="media-picker">
    <span className="media-picker-title">{label}</span>
    {value && <img className="media-picker-preview" src={`/api/media/${value}`} alt={selected?.altText || label} />}
    <label className={`media-upload-button ${busy ? 'is-busy' : ''}`} htmlFor={inputId}>
      {busy ? <LoaderCircle className="upload-spinner" aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}
      <span>{busy ? 'Preparando e enviando…' : value ? 'Trocar foto' : 'Escolher foto do aparelho'}</span>
      <input id={inputId} ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={busy} onChange={(event) => void send(event.target.files?.[0])} />
    </label>
    <small>As fotos são ajustadas automaticamente para carregar rápido.</small>
    {library && options.length > 0 && <label className="media-library-select">Ou escolha uma foto já enviada<select value={value} disabled={busy} onChange={(event) => { onChange(event.target.value); setSuccess(false); }}><option value="">Sem foto</option>{options.map((item) => <option key={item.id} value={item.id}>{item.altText}</option>)}</select></label>}
    {success && <p className="media-upload-success" role="status"><Check aria-hidden="true" /> Foto pronta. Salve as alterações abaixo para publicar.</p>}
    {error && <p className="media-upload-error" role="alert">{error}</p>}
  </div>;
}
