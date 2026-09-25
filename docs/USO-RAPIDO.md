# Nexius: uso rápido

## Abrir a demonstração

1. Abra `INICIAR-NEXIUS.cmd`.
2. Entre em `http://localhost:3000`.
3. Para a gestão, abra **CONFIGURAR-ACESSO.cmd**, escolha um usuário e senha de pelo menos 12 caracteres. A senha não aparece durante a digitação e não há senha padrão.
4. Acesse `http://localhost:3000/gestao`.

Para mostrar ao cliente pela internet, abra `https://nexius-barber-demo.gabsilvanogueira.chatgpt.site`. O aviso de demonstração significa que os horários criados ali não são reservas oficiais. Para a gestão hospedada, acrescente `/gestao` e use a credencial entregue separadamente pelo responsável técnico.

## Fotos

Na gestão, entre em **Fotos e conteúdo**:

1. Escolha uma imagem JPG, PNG ou WebP, até 5 MB, e escreva uma descrição acessível.
2. Toque em **Armazenar imagem**.
3. Selecione a imagem em Logo, Foto da abertura, Trabalhos ou Ambiente.
4. Toque em **Salvar conteúdo**. Para foto de serviço ou barbeiro, escolha a imagem no Catálogo ou em Equipe e horários e salve o cadastro.

Enviar o arquivo não publica automaticamente. Use fotos originais autorizadas. O arquivo fica no R2 e a referência fica no D1. Na demonstração local ambos estão no computador; ao publicar, as fotos precisam ser enviadas ao ambiente hospedado.

## Reservas do cliente

O cliente escolhe serviço, profissional e horário, informa nome e telefone, revisa e confirma. Não precisa de conta nem senha. A reserva é gravada antes de abrir WhatsApp.

“Meus agendamentos” funciona no mesmo navegador por até 30 dias. Se apagar cookies, trocar de aparelho ou encerrar o acesso, precisa falar com a barbearia usando a referência da reserva. Digitar um telefone não dá acesso ao histórico de ninguém.

## WhatsApp

Em Fotos e conteúdo, preencha o **WhatsApp confirmado**, com país + DDD + número, apenas dígitos. Exemplo de formato brasileiro: `55` + DDD + número. O número da Nexius ainda precisa ser confirmado pelo responsável antes de ativar esse link.

Depois de confirmar uma reserva, o site abre uma mensagem com nome, serviço, barbeiro, data/hora, valor, referência, endereço e orientação sobre cancelamento/remarcação. O cliente revisa e toca em **Enviar**. Pode desmarcar a abertura automática antes da confirmação ou usar o botão de WhatsApp no comprovante depois. Não existe envio automático por API.

A reserva permanece válida na agenda do sistema mesmo se o cliente não enviar a mensagem. Pedir cancelamento pelo WhatsApp não cancela sozinho: a equipe deve registrar o cancelamento no painel. O cancelamento online respeita o prazo configurado.

## Agenda e planilha

Ao entrar na gestão, a primeira tela é **Agenda do dia**. Use Hoje, dia anterior/próximo, data, profissional, situação ou busca por nome/telefone/referência. Horário, cliente, serviço, barbeiro e situação aparecem sem abrir cada reserva. Há atalhos de contato e conclusão.

**Baixar planilha** exporta o dia e os filtros atuais em CSV UTF-8, com separador `;`, compatível com Excel. Se o Excel não separar as colunas automaticamente, importe em Dados > De Texto/CSV, escolhendo UTF-8 e ponto e vírgula. A exportação inclui telefones; guarde-a com cuidado. Não é um arquivo `.xlsx`.

Para cadastrar manualmente, remarcar, cancelar ou marcar falta, use **Nova reserva / semana** (agenda completa). A agenda atualiza a cada minuto e também pelo botão Atualizar.

## Limites desta revisão

Esta ainda é uma demonstração, não uma segunda agenda oficial. O catálogo, preços, duração, escalas, políticas, fotos e WhatsApp precisam ser confirmados pelo cliente antes da ativação real. A abertura do WhatsApp foi implementada, mas nenhuma mensagem é enviada automaticamente e o número oficial ainda precisa ser confirmado na gestão.
