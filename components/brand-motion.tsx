'use client';
import { useEffect, useState } from 'react';
import { animate } from 'motion';
import { CalendarDays, Scissors, UserRound } from 'lucide-react';

export function BrandMotion() {
  const [showDock, setShowDock] = useState(false);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = matchMedia('(pointer: fine)');
    const animated = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || animated.has(entry.target)) continue;
          animated.add(entry.target);
          observer.unobserve(entry.target);
          if (!media.matches)
            animate(entry.target, { opacity: [0.25, 1], transform: ['translateY(28px)', 'translateY(0)'] }, { duration: 0.65, ease: 'easeOut' });
        }
      },
      { threshold: 0.12 },
    );
    document
      .querySelectorAll(
        '.manifesto > *, .brand-transition, .public-services > header, .public-service-list article, .before-after-section > *, .public-photo-gallery > *, .public-team > header, .team-editorial article, .demo-testimonials > *, .system-showcase > *, .contact-callout, .contact-grid article',
      )
      .forEach((el) => observer.observe(el));
    const action = document.querySelector('.hero-actions');
    const dockObserver = new IntersectionObserver((entries) =>
      setShowDock(!entries[0].isIntersecting && window.scrollY > 200),
    );
    if (action) dockObserver.observe(action);
    const hero = document.querySelector<HTMLElement>('.hero');
    const magnetic = document.querySelector<HTMLElement>('.hero-actions .button-primary');
    const moveSpotlight = (event: PointerEvent) => {
      if (!hero || media.matches || !finePointer.matches) return;
      const bounds = hero.getBoundingClientRect();
      hero.style.setProperty('--spot-x', `${event.clientX - bounds.left}px`);
      hero.style.setProperty('--spot-y', `${event.clientY - bounds.top}px`);
    };
    const moveButton = (event: PointerEvent) => {
      if (!magnetic || media.matches || !finePointer.matches) return;
      const bounds = magnetic.getBoundingClientRect();
      const x = (event.clientX - bounds.left - bounds.width / 2) * 0.16;
      const y = (event.clientY - bounds.top - bounds.height / 2) * 0.16;
      magnetic.style.transform = `translate(${x}px, ${y}px)`;
    };
    const resetButton = () => { if (magnetic) magnetic.style.transform = ''; };
    hero?.addEventListener('pointermove', moveSpotlight);
    magnetic?.addEventListener('pointermove', moveButton);
    magnetic?.addEventListener('pointerleave', resetButton);
    return () => {
      observer.disconnect();
      dockObserver.disconnect();
      hero?.removeEventListener('pointermove', moveSpotlight);
      magnetic?.removeEventListener('pointermove', moveButton);
      magnetic?.removeEventListener('pointerleave', resetButton);
    };
  }, []);
  return (
    <nav
      className={`mobile-dock ${showDock ? 'dock-visible' : ''}`}
      aria-label="Acesso rápido"
      inert={!showDock}
    >
      <a href="#servicos">
        <Scissors />
        <span>Serviços</span>
      </a>
      <a href="/cliente">
        <UserRound />
        <span>Reservas</span>
      </a>
      <a className="dock-book" href="/agendar">
        <CalendarDays />
        <span>Agendar</span>
      </a>
    </nav>
  );
}
