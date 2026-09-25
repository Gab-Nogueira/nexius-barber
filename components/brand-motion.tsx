'use client';
import { useEffect, useState } from 'react';
import { CalendarDays, Scissors, UserRound } from 'lucide-react';

export function BrandMotion() {
  const [showDock, setShowDock] = useState(false);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const animated = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || animated.has(entry.target)) continue;
          animated.add(entry.target);
          observer.unobserve(entry.target);
          if (!media.matches)
            entry.target.animate(
              [
                { opacity: 0.15, transform: 'translateY(28px)' },
                { opacity: 1, transform: 'translateY(0)' },
              ],
              { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)' },
            );
        }
      },
      { threshold: 0.12 },
    );
    document
      .querySelectorAll(
        '.manifesto > *, .brand-transition, .public-services > header, .public-service-list article, .public-team > header, .team-editorial article, .contact-callout, .contact-grid article',
      )
      .forEach((el) => observer.observe(el));
    const action = document.querySelector('.hero-actions');
    const dockObserver = new IntersectionObserver((entries) =>
      setShowDock(!entries[0].isIntersecting && window.scrollY > 200),
    );
    if (action) dockObserver.observe(action);
    return () => {
      observer.disconnect();
      dockObserver.disconnect();
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
