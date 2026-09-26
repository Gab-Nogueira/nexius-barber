# Revisão para apresentação — 25/09/2026

## Experiência do cliente

- Hierarquia, margens e largura máxima revistas para desktop e monitores grandes, sem ampliar o texto indefinidamente. Nomes e botões da equipe não ficam cortados.
- Leonardo abre o mesmo agendador, já selecionado, sem pedir o serviço duas vezes.
- Fotos configuradas aparecem no catálogo público e na escolha do serviço. Retratos configurados aparecem na escolha do profissional. Não foram inventadas fotos reais da equipe ou dos cortes.
- Horários em grupos (manhã/tarde/noite), seleção destacada, resumo e microinterações com movimento reduzido respeitado.
- Nome, telefone e e-mail na reserva pública. O e-mail não serve para entrar na conta de outra pessoa.
- Google Agenda com dados preenchidos; arquivo iCalendar com `VALARM` de uma hora. O cliente precisa salvar e conferir o alerta. Não há convite por e-mail, sincronização ou garantia de notificação pelo sistema operacional.
- Seção promocional 7 removida; copyright e crédito do desenvolvedor no rodapé.

## Rotina do administrador

- Agenda do dia continua sendo a primeira tela, com filtros, atalhos e exportação CSV. O CSV também inclui e-mail, quando informado.
- Foto enviada diretamente no serviço/profissional ou na seção do site, com prévia, otimização e mensagem de erro útil. É necessário salvar o cadastro após enviar.
- Combos e opções de organização recolhidos em “Opções avançadas”. Vinculação técnica da conta da equipe também fica recolhida.
- Auditoria removida da navegação; registros internos mantidos para rastreabilidade de alterações.

## Verificações executadas

- 55 testes de integração e 13 unitários aprovados: concorrência, sobreposição, preço no servidor, repetição sem duplicar, autorização, sessão, origens externas, exportação segura, validação de imagens, persistência de e-mail e privacidade do calendário.
- Chrome local: reserva completa com e-mail, confirmação, área do cliente, login da gestão, pesquisa em 40 serviços de teste, upload → prévia → salvar serviço → recuperação pública da foto, navegação por teclado, orientação horizontal e reflow a 200%.
- Portal: verificações de largura e limites do texto em 360, 390, 768, 1024, 1440, 1920 e 2560 px; capturas de celular/desktop inspecionadas. Tema, tour, galeria, comparador, instalação e movimento reduzido verificados.
- Fluxo direto do Leonardo aprovado em 360, 390, 768 e 1024 px.
- Tipagem TypeScript, lint e build executados. A publicação deve ser confirmada pelo estado da hospedagem, não apenas por este documento.

Limites: testes em Chrome com dimensões emuladas não substituem iPhone/iPad físicos nem Safari. Não foi disparada notificação real em conta Google/Apple. Esta revisão não é certificação de segurança nem teste de invasão exaustivo. Dados de teste ficaram no ambiente local, não foram migrados para a agenda pública.

## Dados e fotos

Recomendação para este projeto: manter **Cloudflare D1** para reservas, clientes, serviços, equipe e configurações, e **R2** para os arquivos das fotos. O código já usa essa separação. A referência, o tipo e a descrição da imagem ficam no banco; os bytes ficam no armazenamento de arquivos. Não há motivo técnico para migrar às pressas na véspera da apresentação.

Referências oficiais: [D1](https://developers.cloudflare.com/d1/), [R2](https://developers.cloudflare.com/r2/). Existem franquias e limites; confirme consumo, cobrança, titularidade da conta e backups antes da operação comercial. Local e hospedado têm bancos/buckets distintos.

## Antes de receber reservas reais

O site continua explicitamente **DEMONSTRAÇÃO**. Validar com o proprietário: catálogo/preços/durações, quais serviços Leonardo e Ismael fazem, escalas, política de cancelamento, WhatsApp oficial e fotos autorizadas. Definir responsável por acesso administrativo, backups e atendimento. Não tratar os exemplos como agenda oficial.

Para entrega amanhã, apresente a navegação e a gestão, valide esses dados com o dono e só então planeje a ativação oficial. Veja [Uso rápido](USO-RAPIDO.md).
