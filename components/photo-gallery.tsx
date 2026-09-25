'use client';
import { useRef, useState } from 'react';

export function PhotoGallery({
  images,
  title,
}: {
  images: Array<{ id: string; altText: string }>;
  title: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [selected, setSelected] = useState(0);
  if (!images.length) return null;
  return (
    <section className="public-photo-gallery">
      <h2>{title}</h2>
      <div>
        {images.map((image, index) => (
          <button
            key={image.id}
            aria-label={`Ampliar: ${image.altText}`}
            onClick={() => {
              setSelected(index);
              dialog.current?.showModal();
            }}
          >
            <img
              src={`/api/media/${image.id}`}
              alt={image.altText}
              loading="lazy"
              width={600}
              height={600}
            />
            <span>{image.altText}</span>
          </button>
        ))}
      </div>
      <dialog ref={dialog} aria-label={title}>
        <button
          className="gallery-close"
          onClick={() => dialog.current?.close()}
        >
          Fechar ×
        </button>
        <img
          src={`/api/media/${images[selected].id}`}
          alt={images[selected].altText}
        />
        <p>
          {images[selected].altText} · {selected + 1}/{images.length}
        </p>
        <div>
          <button
            onClick={() =>
              setSelected((selected + images.length - 1) % images.length)
            }
          >
            Anterior
          </button>
          <button onClick={() => setSelected((selected + 1) % images.length)}>
            Próxima
          </button>
        </div>
      </dialog>
    </section>
  );
}
