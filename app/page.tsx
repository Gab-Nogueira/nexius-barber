import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Camera,
  MapPin,
  Phone,
  UserRound,
} from 'lucide-react';
import { getCatalog } from '@/lib/booking-engine';
import { formatMoney } from '@/lib/nexius';
import { publicContent } from '@/lib/content';
import { PhotoGallery } from '@/components/photo-gallery';
import { BrandMotion } from '@/components/brand-motion';
import './gallery.css';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const catalog = await getCatalog();
  const content = await publicContent();
  const { values } = content;
  const observedServices = catalog.services.filter(
    (service) => service.source !== 'demo',
  );
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Barbershop',
    name: 'Nexius Barber',
    telephone: values.business_phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: values.business_address,
      addressLocality: 'São José dos Campos',
      addressRegion: 'SP',
      addressCountry: 'BR',
    },
    sameAs: [values.instagram_url],
  };

  return (
    <main>
      <BrandMotion />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <div className="demo-bar" role="status">
        <span>Demonstração</span>Os horários não são reservas reais
      </div>
      <header className="site-header">
        <a
          className="wordmark"
          href="#inicio"
          aria-label="Nexius Barber — início"
        >
          {content.logo ? (
            <img
              className="official-logo"
              src={`/api/media/${content.logo.id}`}
              alt={content.logo.altText}
            />
          ) : (
            <>
              NE<span>X</span>IUS <small>BARBER</small>
            </>
          )}
        </a>
        <nav aria-label="Navegação principal">
          <a href="#sobre">Sobre</a>
          <a href="#servicos">Serviços</a>
          <a href="#equipe">Equipe</a>
          <a href="#contato">Contato</a>
        </nav>
        <a className="header-cta" href="/agendar">
          Agendar <ArrowUpRight aria-hidden="true" size={18} />
        </a>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">
            <span>01</span> São José dos Campos
          </p>
          {values.slogan === 'Não é só corte, é conexão' ? (
            <>
              <h1>
                NÃO É SÓ<span>CORTE.</span>
              </h1>
              <p className="hero-statement">É CONEXÃO.</p>
            </>
          ) : (
            <h1>{values.slogan}</h1>
          )}
          <p className="hero-body">{values.hero_text}</p>
          <div className="hero-actions">
            <a className="button button-primary" href="/agendar">
              <CalendarDays aria-hidden="true" size={20} /> Agendar meu horário
            </a>
            <a className="button button-ghost" href="#sobre">
              Conhecer a Nexius <ArrowDown aria-hidden="true" size={18} />
            </a>
          </div>
        </div>
        <div className="hero-art" aria-label="Identidade visual Nexius Barber">
          {content.hero && (
            <img
              className="hero-official-photo"
              src={`/api/media/${content.hero.id}`}
              alt={content.hero.altText}
              fetchPriority="high"
            />
          )}
          <div className="x-frame">
            <span className="x-line x-line-a" />
            <span className="x-line x-line-b" />
            <div className="brand-panel">
              <p>NEXIUS</p>
              <span>BARBER</span>
            </div>
          </div>
          <p className="art-caption">
            <span>Nova fase</span> Identidade em movimento
          </p>
        </div>
        <a
          className="scroll-cue"
          href="#sobre"
          aria-label="Rolar para conhecer a Nexius"
        >
          <span>Explorar</span>
          <ArrowDown aria-hidden="true" size={18} />
        </a>
      </section>

      <section className="manifesto" id="sobre">
        <p className="section-index">02 / NOVA FASE</p>
        <h2>
          Um espaço para <em>cuidar</em> do seu estilo e do seu tempo.
        </h2>
        <div>
          <p>{values.about_text}</p>
          <a href="/agendar">
            Ver horários disponíveis{' '}
            <ArrowUpRight aria-hidden="true" size={18} />
          </a>
        </div>
      </section>

      <section className="brand-transition" aria-label="Conexão em movimento">
        <img
          src="/nexius-concrete-x.png"
          alt="Composição abstrata em concreto escuro com linhas roxas em formato de X"
        />
        <div>
          <p>CONEXÃO EM MOVIMENTO</p>
          <h2>
            Duas linhas.
            <br />
            Um encontro.
          </h2>
          <span>Direção visual da nova experiência digital Nexius.</span>
        </div>
      </section>

      <section className="public-services" id="servicos">
        <header>
          <div>
            <p className="section-index">03 / SERVIÇOS OBSERVADOS</p>
            <h2>
              Escolha com <em>clareza.</em>
            </h2>
          </div>
          <p>
            Os valores abaixo foram observados nos materiais recebidos. Duração
            e disponibilidade são demonstrativas até validação.
          </p>
        </header>
        <div className="public-service-list">
          {observedServices.map((service, index) => (
            <article key={service.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
              </div>
              <strong>{formatMoney(service.priceCents)}</strong>
              <a href={`/agendar?servico=${service.id}`}>
                Agendar este serviço <ArrowRight aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
        <a className="catalog-link" href="/agendar">
          Abrir catálogo da demonstração <ArrowUpRight aria-hidden="true" />
        </a>
      </section>
      <PhotoGallery images={content.gallery} title="Trabalhos Nexius" />
      <PhotoGallery images={content.environment} title="Conheça o ambiente" />

      <section className="public-team" id="equipe">
        <header>
          <p className="section-index">04 / EQUIPE OBSERVADA</p>
          <h2>
            Escolha quem vai cuidar do seu <em>momento.</em>
          </h2>
        </header>
        <div className="team-editorial">
          {catalog.professionals.map((professional, index) => (
            <article key={professional.id}>
              <div className="team-portrait">
                {professional.photoId ? (
                  <img
                    src={`/api/media/${professional.photoId}`}
                    alt={professional.photoAlt || professional.name}
                    loading="lazy"
                  />
                ) : (
                  <>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <UserRound aria-hidden="true" />
                  </>
                )}
              </div>
              <div>
                <p>PROFISSIONAL</p>
                <h3>{professional.name}</h3>
                <span>Conheça os serviços disponíveis no agendamento.</span>
                <a href={`/agendar?profissional=${professional.id}`}>
                  Agendar com {professional.name} <ArrowUpRight />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="contact-section" id="contato">
        <div className="contact-callout">
          <p className="section-index">05 / CONTATO</p>
          <h2>
            Seu próximo horário começa <em>aqui.</em>
          </h2>
          <a className="button button-primary" href="/agendar">
            <CalendarDays /> Agendar meu horário
          </a>
        </div>
        <div className="contact-grid">
          <article>
            <MapPin />
            <span>Endereço informado</span>
            <strong>{values.business_address}</strong>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(values.business_address)}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir rota <ArrowUpRight />
            </a>
          </article>
          <article>
            <Phone />
            <span>Telefone comercial</span>
            <strong>{values.business_phone}</strong>
            <a href={`tel:${values.business_phone.replace(/[^+\d]/g, '')}`}>
              Ligar agora <ArrowUpRight />
            </a>
            {values.whatsapp_number ? (
              <a
                href={`https://wa.me/${values.whatsapp_number}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp <ArrowUpRight />
              </a>
            ) : (
              <small>WhatsApp ainda não validado como canal oficial.</small>
            )}
          </article>
          <article>
            <Camera />
            <span>Instagram</span>
            <strong>Nexius Barber</strong>
            <a href={values.instagram_url} target="_blank" rel="noreferrer">
              Ver perfil <ArrowUpRight />
            </a>
          </article>
        </div>
      </section>

      <footer className="site-footer">
        <a className="wordmark" href="#inicio">
          NE<span>X</span>IUS <small>BARBER</small>
        </a>
        <div>
          <a href="/agendar">Agendar</a>
          <a href="/cliente">Área do cliente</a>
          <a href="/profissional">Equipe</a>
          <a href="/gestao">Gestão</a>
        </div>
        <p>Demonstração funcional — não substitui a agenda oficial.</p>
        {values.developer_url && (
          <a href={values.developer_url} target="_blank" rel="noreferrer">
            Desenvolvido por Gabriel Nogueira
          </a>
        )}
      </footer>
    </main>
  );
}
