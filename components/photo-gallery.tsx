'use client';
import { useRef, useState } from 'react';

export function PhotoGallery({
  images,
  title,
}: {
  images: Array<{ id: string; altText: string; src?: string; demo?: boolean }>;
  title: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [selected, setSelected] = useState(0);
  if (!images.length) return null;
  return (
    <section className="public-photo-gallery" aria-label={title}>
      <h2>{title}</h2>
      {images.some((image) => image.demo) && <p className="gallery-demo-note">Imagem gerada apenas para demonstrar a galeria. Não é um trabalho realizado pela Nexius.</p>}
      <div>
        {images.map((image, index) => (
          <button
            type="button"
            key={image.id}
            aria-label={`Ampliar: ${image.altText}`}
            onClick={() => {
              setSelected(index);
              dialog.current?.showModal();
            }}
          >
            <img
              src={image.src ?? `/api/media/${image.id}`}
              alt={image.altText}
              loading="lazy"
              width={600}
              height={600}
            />
            <span>{image.altText}{image.demo ? ' · EXEMPLO' : ''}</span>
          </button>
        ))}
      </div>
      <dialog ref={dialog} aria-label={title} onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); setSelected((selected + images.length - 1) % images.length); }
        if (event.key === 'ArrowRight') { event.preventDefault(); setSelected((selected + 1) % images.length); }
      }}>
        <button
          type="button"
          className="gallery-close"
          onClick={() => dialog.current?.close()}
        >
          Fechar ×
        </button>
        <img
          src={images[selected].src ?? `/api/media/${images[selected].id}`}
          alt={images[selected].altText}
        />
        <p>
          {images[selected].altText} · {selected + 1}/{images.length}{images[selected].demo ? ' · Imagem demonstrativa' : ''}
        </p>
        <div>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={() =>
              setSelected((selected + images.length - 1) % images.length)
            }
          >
            Anterior
          </button>
          <button type="button" aria-label="Próxima foto" onClick={() => setSelected((selected + 1) % images.length)}>
            Próxima
          </button>
        </div>
      </dialog>
    </section>
  );
}
