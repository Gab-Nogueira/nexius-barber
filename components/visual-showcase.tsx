'use client';

import { useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, CalendarDays, Download, LayoutDashboard, MessageCircle, ShieldCheck } from 'lucide-react';

export function BeforeAfter() {
  const [reveal, setReveal] = useState(50);
  return <section className="before-after-section" id="transformacao" aria-labelledby="before-after-title">
    <div className="showcase-heading"><p className="section-index">04 / VISUALIZAÇÃO</p><h2 id="before-after-title">A diferença está nos <em>detalhes.</em></h2><p>Comparação visual ilustrativa. As fotos abaixo foram geradas para esta demonstração e não mostram um atendimento real da Nexius.</p></div>
    <div className="before-after-frame" style={{ '--reveal': `${reveal}%` } as CSSProperties}>
      <div className="comparison-after" role="img" aria-label="Exemplo gerado de corte e barba após atendimento" />
      <div className="comparison-before" role="img" aria-label="Exemplo gerado de cabelo e barba antes do atendimento" />
      <span className="comparison-label comparison-label-before">ANTES · EXEMPLO</span><span className="comparison-label comparison-label-after">DEPOIS · EXEMPLO</span>
      <span className="comparison-divider" aria-hidden="true"><span>↔</span></span>
      <input type="range" min="0" max="100" value={reveal} onChange={(event) => setReveal(Number(event.target.value))} aria-label="Arraste para comparar o antes e depois ilustrativo" aria-valuetext={`${reveal}% da imagem de antes visível`} />
    </div>
    <p className="demo-disclaimer">Material gerado para apresentar a interação. Substituir por fotos autorizadas de um mesmo cliente antes da publicação oficial.</p>
  </section>;
}

const demoStatements = [
  { heading: 'Agendamento em poucos passos', text: 'Exemplo de depoimento: “Escolhi o serviço, vi o horário e confirmei sem precisar esperar resposta.”' },
  { heading: 'Tudo no mesmo lugar', text: 'Exemplo de depoimento: “Consigo consultar minha reserva e encontrar as informações do atendimento.”' },
  { heading: 'Mais clareza para a equipe', text: 'Exemplo de depoimento: “A agenda do dia mostra o que vem a seguir com rapidez.”' },
];

export function DemoTestimonials() {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  return <section className="demo-testimonials" aria-labelledby="testimonials-title">
    <div><p className="section-index">06 / EXPERIÊNCIA ILUSTRATIVA</p><h2 id="testimonials-title">A experiência que queremos <em>entregar.</em></h2><p>Os textos a seguir são exemplos de apresentação. Não representam clientes nem avaliações reais.</p></div>
    <div className="testimonial-stage"><div className="testimonial-stage-top"><span>DEMONSTRAÇÃO · NÃO É AVALIAÇÃO REAL</span><div><button type="button" aria-label="Exemplo anterior" onClick={() => setIndex((index + demoStatements.length - 1) % demoStatements.length)}><ArrowLeft /></button><button type="button" aria-label="Próximo exemplo" onClick={() => setIndex((index + 1) % demoStatements.length)}><ArrowRight /></button></div></div>
      <AnimatePresence mode="wait"><motion.div key={index} initial={reduceMotion ? false : { opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -28 }} transition={{ duration: reduceMotion ? 0 : .28 }}><h3>{demoStatements[index].heading}</h3><p>{demoStatements[index].text}</p></motion.div></AnimatePresence><span className="testimonial-counter">0{index + 1} / 0{demoStatements.length}</span>
    </div>
  </section>;
}

const mockups = [
  { eyebrow: 'AGENDA DO DIA', title: 'O dia inteiro, de relance.', icon: CalendarDays, rows: ['09:00 · Corte · Profissional', '10:30 · Barba · Profissional', '14:00 · Corte infantil · Profissional'] },
  { eyebrow: 'VISÃO GERAL', title: 'Números úteis, sem planilhas abertas.', icon: LayoutDashboard, rows: ['Ocupação da agenda', 'Atendimentos futuros', 'Valores previstos'] },
  { eyebrow: 'EXPORTAÇÃO', title: 'Informações prontas para organizar.', icon: Download, rows: ['Filtro por dia', 'Filtro por profissional', 'Arquivo CSV para planilha'] },
];

export function ManagementShowcase({ contactUrl }: { contactUrl?: string }) {
  const [index, setIndex] = useState(0);
  const [comparison, setComparison] = useState<'manual' | 'nexius'>('nexius');
  const reduceMotion = useReducedMotion();
  const Icon = mockups[index].icon;
  return <section className="system-showcase" id="sistema" aria-labelledby="system-title">
    <header><p className="section-index">07 / PARA QUEM ADMINISTRA</p><h2 id="system-title">A barbearia no <em>controle.</em></h2><p>O portal é a vitrine. O painel de gestão é onde a operação acontece, com acesso reservado à equipe.</p></header>
    <div className="system-grid"><div className="system-copy"><span className="system-number">0{index + 1} / 0{mockups.length}</span><h3>{mockups[index].title}</h3><p>Prévia ilustrativa das funções existentes. Dados e horários abaixo são exemplos, não reservas reais.</p><div className="system-controls"><button type="button" onClick={() => setIndex((index + mockups.length - 1) % mockups.length)} aria-label="Tela anterior"><ArrowLeft /></button><button type="button" onClick={() => setIndex((index + 1) % mockups.length)} aria-label="Próxima tela"><ArrowRight /></button></div></div>
      <div className="management-mock-shell"><div className="management-mock-window"><div className="mock-window-top"><span>NE<span>X</span>IUS / GESTÃO</span><span>PRÉVIA ILUSTRATIVA</span></div><AnimatePresence mode="wait"><motion.div key={index} initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -16 }} transition={{ duration: reduceMotion ? 0 : .3 }} className="mock-window-body"><div className="mock-window-title"><Icon aria-hidden="true" /><div><small>{mockups[index].eyebrow}</small><strong>{mockups[index].title}</strong></div></div><div className="mock-window-lines">{mockups[index].rows.map((row, rowIndex) => <div key={row}><span>0{rowIndex + 1}</span><strong>{row}</strong><i aria-hidden="true" /></div>)}</div></motion.div></AnimatePresence></div></div>
    </div>
    <div className="system-comparison"><div><p className="section-index">O QUE MUDA NA ROTINA</p><h3>Menos idas e vindas. <em>Mais visão.</em></h3></div><div className="comparison-toggle" role="group" aria-label="Comparar rotina"><button type="button" className={comparison === 'manual' ? 'active' : ''} aria-pressed={comparison === 'manual'} onClick={() => setComparison('manual')}>WhatsApp manual</button><button type="button" className={comparison === 'nexius' ? 'active' : ''} aria-pressed={comparison === 'nexius'} onClick={() => setComparison('nexius')}>Com Nexius</button></div><div className="comparison-result" aria-live="polite">{comparison === 'manual' ? <><MessageCircle aria-hidden="true" /><p>Mensagens dispersas e conferência manual de horários. É assim que muitos atendimentos começam; este cenário é apenas uma comparação ilustrativa.</p></> : <><ShieldCheck aria-hidden="true" /><p>Cliente consulta disponibilidade e registra a reserva; a equipe acompanha pela agenda diária, e o cliente pode cancelar ou remarcar dentro das regras configuradas.</p></>}</div></div>
    <div className="system-benefits"><span>Reserva registrada na agenda</span><span>Área do cliente para remarcar</span><span>Indicadores de ocupação e valores</span><span>Exportação por dia em CSV</span></div>
    <p className="system-honesty">Envio automático de WhatsApp e lembretes externos não estão ativos nesta demonstração. O cliente abre uma mensagem pronta para revisar e enviar.</p>
    {contactUrl && <a className="button button-primary system-contact" href={contactUrl} target="_blank" rel="noopener noreferrer">Quero apresentar o sistema <ArrowRight aria-hidden="true" /></a>}
  </section>;
}
