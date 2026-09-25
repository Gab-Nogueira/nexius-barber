type MessageBooking = {
  clientName: string; timezone: string; professionalName: string; startAt: string;
  totalCents: number; reference: string; cancellationLimitHours: number; status: string;
  services: Array<{ name: string }>;
};
export function formatBookingWhatsApp(booking: MessageBooking, number: string, address: string, demo: boolean) {
  if (!/^\d{12,15}$/.test(number)) return null;
  const when = new Intl.DateTimeFormat('pt-BR', { timeZone: booking.timezone, dateStyle: 'full', timeStyle: 'short' }).format(new Date(booking.startAt));
  const status: Record<string,string> = { confirmed:'Confirmado',pending:'Pendente',cancelled:'Cancelado',completed:'Concluído',no_show:'Não compareceu' };
  const price = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(booking.totalCents/100);
  const message = [demo ? '*DEMONSTRAÇÃO — não é uma reserva real*' : '*Agendamento Nexius Barber*',
    `Olá! Sou ${booking.clientName}. Este é o resumo do meu agendamento pelo site.`,
    `✂️ ${booking.services.map(s => s.name).join(' + ')}`, `Profissional: ${booking.professionalName}`,
    `Data e horário: ${when}`, `Valor: ${price}`, `Referência: ${booking.reference}`,
    `Situação: ${status[booking.status] || booking.status}`, `Endereço: ${address}`, '',
    `Se precisar cancelar ou remarcar, posso falar por aqui. Pelo site, o prazo é de ${booking.cancellationLimitHours} horas antes do atendimento.`,
    'O registro já está na agenda do site. Obrigado!'].join('\n');
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
