# NEXIUS BARBER — demonstração funcional

Portal full stack de demonstração para a NEXIUS BARBER, com apresentação institucional, fluxo próprio de agendamento, área do cliente, área do profissional e painel de gestão.

> **Importante:** este ambiente é isolado e demonstrativo. Os horários criados aqui não são reservas reais. O sistema atual deve continuar como fonte oficial até a validação operacional e a migração planejada.

## Abrir agora

**Revisão mobile e gestão:** consulte [USO-RAPIDO](docs/USO-RAPIDO.md) para acesso por senha, fotos, agenda diária, planilha e WhatsApp. A recomendação de servidor gratuito e suas limitações estão em [HOSPEDAGEM](docs/HOSPEDAGEM.md).

Para criar seu usuário e senha **locais**, abra `CONFIGURAR-ACESSO.cmd`. Não há senha padrão e o cliente não precisa criar conta. A gestão agora começa em Agenda do dia. O modo atual é `AUTH_MODE=password`; o antigo acesso demonstrativo automático via ChatGPT não está habilitado por padrão.

No Windows, abra `INICIAR-NEXIUS.cmd`. Ele verifica o Node.js, instala as dependências se necessário, aplica as migrações pendentes e inicia `http://localhost:3000`.

O endereço de demonstração deste projeto é `https://nexius-barber-demo.gabsilvanogueira.chatgpt.site`. A versão online permanece identificada como **DEMONSTRAÇÃO**, não é a agenda oficial e não deve receber reservas reais antes da validação dos dados e da transição operacional. Confira se a última publicação foi concluída antes de apresentar mudanças recentes.

## O que está implementado

### Apresentação visual da demonstração

- Portal mobile-first com contraste preto/branco/roxo, textura discreta, malha em X, spotlight, reveal e microinterações; o botão **Ver como funciona** conduz um tour para apresentar o sistema ao dono.
- Indicador de horários de hoje consulta a API existente para o primeiro serviço observado. É indicativo, nunca uma promessa de vaga: a disponibilidade é revalidada na confirmação.
- Comparador antes/depois, galeria e textos de experiência identificados como **demonstração**. As duas imagens geradas por IA não representam clientes, equipe nem trabalhos reais; veja [proveniência dos materiais](docs/MATERIAIS-DEMO.md).
- Prévia ilustrativa do painel, comparação da rotina manual com a agenda online e contato comercial de apresentação pelo WhatsApp informado pelo desenvolvedor. Esse contato não substitui o WhatsApp oficial da Nexius.
- Tema claro/escuro opcional no portal público (preferência local e preferência do sistema), ícone da Nexius, manifesto instalável e aviso offline. A agenda exige conexão; o PWA não cria reservas offline.
- Animações e transições respeitam `prefers-reduced-motion`; em telas táteis a rolagem continua nativa.

- Portal público responsivo, com identidade preta, branca e roxa, navegação, serviços observados, equipe, contato e localização.
- Agendamento em cinco etapas: serviços, profissional, data/horário, identificação/revisão e confirmação persistida.
- Busca tolerante a acentos, categorias, seleção múltipla compatível, resumo de preço e duração.
- Disponibilidade calculada no servidor em `America/Sao_Paulo`, incluindo grade, pausa, bloqueios, antecedência, horizonte, duração completa e conflitos.
- Inserção atômica por `INSERT ... SELECT ... WHERE NOT EXISTS`, executada com itens, auditoria e notificação local em um lote transacional D1.
- Idempotência com chave única e hash da requisição; repetição compatível recupera a reserva e reutilização incompatível é recusada.
- Área do cliente autenticada, com próximos horários, histórico, remarcação atômica, cancelamento e arquivo `.ics`.
- Painel com agenda diária/semanal em listas responsivas, filtros, reserva manual, remarcação, cancelamento, conclusão e não comparecimento.
- Cadastro/edição de categorias, serviços, adicionais, combos, fotos, ordem e situação; habilitações e preços/durações por profissional.
- Equipe, vinculação de conta, escala semanal, pausas, funcionamento da unidade, fechamentos e bloqueios; conflitos futuros impedem alterações silenciosas.
- Textos, contatos, links, logo, fotos da abertura, galerias de trabalhos/ambiente, ampliação acessível, upload persistente e auditoria.
- Indicadores por mês com minutos da grade, pausas e bloqueios; valor previsto e valor dos serviços concluídos separados de recebimentos.
- Área do profissional restrita à própria agenda e às ações permitidas.
- Persistência relacional em Cloudflare D1 e arquivos em R2.
- Gestão com usuário/senha e sessão HttpOnly; cliente com sessão privada no navegador, sem cadastro. Autorização aplicada novamente nas APIs.
- Estados de carregamento, vazio, erro, conflito e sucesso, foco visível e suporte a `prefers-reduced-motion`.
- Revisão oficial de preço/duração/política por profissional, resumo visível também no celular e recuperação da mesma tentativa após timeout.
- Dados de contato do cliente e proteção contra leitura/alteração de reservas de outra conta.

## Fontes dos dados

### Observado nos prints

- Nome: NEXIUS BARBER.
- Slogan: “Não é só corte, é conexão”.
- Instagram: `@nexius_barber`.
- Endereço: Avenida das Rosas, 341, Jardim Motorama, São José dos Campos — SP.
- Telefone informado: `(12) 98814-9114`.
- Profissionais visíveis: Ismael e Leonardo.
- Serviços visíveis para Ismael: Corte — R$ 40,00; Corte infantil (3 a 8 anos) — R$ 40,00.

### Proposta da demonstração

- Confirmação automática.
- Duração de 45 minutos para Corte e 40 minutos para Corte infantil.
- Grade de segunda a sábado, das 9h às 18h, com pausa das 12h às 13h.
- Antecedência mínima de 60 minutos, horizonte de 30 dias e passo de 30 minutos.
- Cancelamento online até 4 horas antes.
- “Barba” e “Acabamento” aparecem somente como exemplos explicitamente identificados da demonstração.
- Imagem abstrata `public/nexius-concrete-x.png`, gerada somente como apoio visual. Ela não representa o salão, clientes ou profissionais reais.

### Pendente de validação

- Catálogo completo, descrições, preços e durações.
- Quais serviços cada profissional executa e eventuais valores específicos.
- Grade real, pausas, folgas, feriados e bloqueios.
- Políticas reais de cancelamento, remarcação e confirmação.
- Logo original e fotos autorizadas do ambiente, equipe e trabalhos.
- CEP e horários de funcionamento da unidade.
- Confirmação de que o telefone informado é também o WhatsApp oficial.
- Provedor real de e-mail, WhatsApp ou SMS. A demonstração registra notificações localmente e não afirma entrega.

## Arquitetura

- **Interface e servidor:** React 19 + Vinext/Next App Router + TypeScript.
- **Persistência:** Cloudflare D1/SQLite, com migrações Drizzle em `drizzle/`.
- **Arquivos:** Cloudflare R2, com metadados relacionais em D1.
- **Autenticação:** senha local com scrypt e sessões persistidas no D1; opção de verificação gerenciada por Supabase Auth para a hospedagem. Clientes usam sessão anônima privada, nunca pesquisa de histórico por telefone.
- **Papéis:** cliente, profissional e administrador. `DEMO_MODE=true` identifica dados sintéticos; no modo de senha, não concede acesso administrativo. O legado `AUTH_MODE=platform` existe somente para compatibilidade com a demonstração anterior do Sites e não deve ser usado na operação pública.

Rotas principais:

- `/` — portal público.
- `/agendar` — fluxo de reserva.
- `/cliente` — área autenticada do cliente.
- `/profissional` — própria agenda do profissional.
- `/gestao` — gestão demonstrativa.

## Execução local

Requisitos: Node.js 22.13 ou superior e npm.

```powershell
npm ci
Copy-Item .env.demo.example .env.local
```

Para a demonstração local, altere `.env.local` para:

```dotenv
DEMO_MODE=true
```

Gere a migração apenas depois de mudar `db/schema.ts`:

```powershell
npm run db:generate
```

Aplique as migrações no banco local:

```powershell
npm run db:migrate
```

Inicie:

```powershell
npm run dev
```

Abra `http://localhost:3000`. Configure o acesso administrativo com `CONFIGURAR-ACESSO.cmd`. Para um perfil de profissional, o responsável técnico provisiona uma credencial de papel `professional` e vincula o ID à ficha correta; não basta informar o nome.

A carga automática ocorre somente quando `DEMO_MODE=true` e a unidade ainda não foi criada. `db/seed-demo.sql` contém a mesma base sintética para carga manual opcional, depois das cinco migrações; não aplique em operação real. `node scripts/seed-showcase.mjs` cria uma reserva fictícia para apresentação.

Não exponha o servidor local na internet. A configuração atual ignora os cabeçalhos de identidade da plataforma e exige sessão própria. Para Cloudflare independente, siga HOSPEDAGEM.md; não habilite o modo legado `platform`, que exige o proxy confiável do Sites.

## Configuração de produção

1. Mantenha `DEMO_MODE=false`.
2. Cadastre o primeiro administrador no banco após autenticar o usuário correto:

```sql
UPDATE users SET role = 'admin' WHERE email = 'email-validado@empresa.com';
```

3. Vincule cada conta profissional ao respectivo perfil:

```sql
UPDATE professionals SET user_id = 'id-autenticado' WHERE id = 'id-do-profissional';
UPDATE users SET role = 'professional' WHERE id = 'id-autenticado';
```

4. Complete catálogo, elegibilidade, grade, políticas, contato, mídias e conteúdo no painel.
5. Reprocesse a disponibilidade e execute os testes com o banco de homologação.
6. Defina uma data de corte e uma única agenda oficial. Não opere o sistema antigo e este portal como agendas reais independentes.

Não existe conta administrativa com senha padrão. No acesso local, senhas são armazenadas como hash scrypt com salt, sessões como SHA-256 de tokens aleatórios e login limitado por usuário e origem. Redefinir a senha pelo script revoga as sessões da conta. O script altera apenas D1 local; não configura a nuvem. Para hospedagem gerenciada, siga HOSPEDAGEM.md.

Em um banco real novo, crie a linha `business_settings` com valores aprovados antes de abrir o painel; não use o seed de demonstração. Comece sem serviços/grades publicados. Serviços precisam estar ativos, com categoria ativa, duração positiva, origem `validated`, profissional habilitado e escala válida para serem reserváveis fora do modo demo. Validar o canal de WhatsApp e cadastrar seu número na gestão ativa somente o link de conversa, nunca envio automático.

## Testes

Com o servidor local em execução:

```powershell
npm run test:integration
npm run test:unit
npx tsc --noEmit
npm run lint
npm run build
```

Os testes cobrem, entre outros pontos:

- concorrência no mesmo profissional e intervalo;
- sobreposição parcial;
- independência entre profissionais;
- pausa e fim de expediente;
- incompatibilidade profissional/serviço;
- repetição e conflito de idempotência;
- recálculo oficial de preço e duração;
- remarcação atômica;
- cancelamento e liberação do horário;
- autenticação para leitura de reservas;
- bloqueios e desativação com conflitos futuros;
- fuso `America/Sao_Paulo`;
- carga sintética com 40 serviços sem publicação no catálogo.

O teste automatizado não substitui a validação dos dados reais da barbearia nem a conciliação com a agenda antiga.

### Revisão visual local em 25/09/2026

Após as mudanças visuais, passaram 54/54 testes de integração, 9/9 testes unitários, TypeScript, lint e build. A navegação automatizada no Chrome local conferiu o portal em 360, 390, 768, 1024 e 1440 px sem rolagem horizontal; tema, tour, comparador, galeria, manifesto PWA, service worker e movimento reduzido também passaram. A entrada direta pelo Leonardo continuou em `serviços → data/horário`, sem repetir a escolha do profissional, em 360, 390, 768 e 1024 px. Esses resultados são locais; não verificam a versão pública nem substituem revisão manual em aparelhos reais.

### Resultado verificado em 22/09/2026

**Revisão atual:** 54/54 testes de integração e 9/9 testes unitários passaram após a troca de autenticação. Build, TypeScript e lint aprovados. A nova suíte cobre reserva sem cadastro, isolamento entre navegadores com o mesmo telefone, senha, excesso de tentativas, expiração, logout, CSV autorizado, proteção contra fórmulas, mensagem de WhatsApp e prévia de importação. A listagem da agenda foi agregada em uma consulta para evitar consultas proporcionais à quantidade de reservas.

**Revisão visual atual:** o fluxo direto de Leonardo foi executado no Chrome com o build de produção, em 360, 390, 768 e 1024 px, sem rolagem horizontal. A entrada agora segue `serviços → data/horário`, sem pedir o profissional novamente. A suíte visual completa anterior continua registrada abaixo. Nenhuma mensagem real foi enviada pelo WhatsApp.

#### Evidências da revisão anterior

- **43/43 testes de integração** aprovados, com chamadas reais às APIs e D1 local.
- **4/4 testes** da prévia de migração aprovados.
- TypeScript, lint e build aprovados.
- Jornada no Chrome concluída em viewport de celular; controles percorridos com Tab/Enter, foco entre etapas, dados preenchidos e confirmação persistida.
- Catálogo com **40 serviços sintéticos reais no banco de teste**: busca sem acentos, resultado único e seleção verificados no navegador. Os registros foram retirados do catálogo ativo depois do teste.
- Larguras 360, 390, 768, 1024 e 1440 sem overflow horizontal; paisagem 844×390 e reflow com escala CSS de 200% verificados. Escala CSS não equivale a um teste manual de zoom nativo em todos os navegadores.
- Nenhuma exceção de JavaScript na rodada de navegação validada. Capturas em `docs/captures/`.
- Medição local, Chrome/Vite de desenvolvimento, cache aquecido, sem throttling: DOMContentLoaded **1.158 ms**, load **1.166 ms**, documento transferido **122.042 bytes**. Não são Core Web Vitals de produção nem pontuação Lighthouse.
- Backup restaurado: **39 reservas**, catálogo, políticas e **3 objetos R2** recuperados com hashes SHA-256 idênticos. Banco de validação preservado separadamente em `backups/validation-state-20260922-1100`; base de apresentação recriada com as mesmas migrações e uma reserva demonstrativa.

A demonstração não se integra à agenda antiga. O envio externo de mensagens e a recuperação de conta por provedor também não fazem parte desta versão; o WhatsApp abre uma mensagem para o cliente revisar e enviar.

O lint ignora componentes de UI gerados e regras específicas incompatíveis com o scaffold Vinext (React Compiler não ativado, `next/image`/`next/link`). As regras de tipos, hooks e acessibilidade aplicáveis continuam ativas; `Input` é reconhecido como controle de formulário.

### Garantia de concorrência

Reservas concorrentes disputam uma inserção condicional executada no banco, dentro de lote transacional D1. Itens, auditoria e notificação local entram no mesmo lote. A comparação inclui o buffer persistido de cada reserva. Triggers avançam revisões da configuração/operação; uma condição `CHECK` aborta o lote inteiro quando a configuração validada mudou antes da gravação. Alterar escala/bloqueio usa revisão operacional, que também muda quando uma reserva é criada ou alterada.

Remarcação atualiza intervalo, preço, itens e auditoria atomicamente. O prazo de cancelar/remarcar fica registrado na reserva; mudanças posteriores de política não o reescrevem. A gestão possui exceção explícita e auditada para prazos, nunca para sobreposição. O teste concorrente inclui inícios diferentes com sobreposição parcial.

## Conteúdo e mídia

O painel aceita JPG, PNG e WebP de até 5 MB e exige texto alternativo. O arquivo vai para R2 e seus metadados para D1. Uma falha no registro relacional remove o objeto recém-enviado para evitar arquivo órfão.

Tipo declarado e assinatura do arquivo são conferidos. O limite multipart do Vinext está configurado em 6 MB para comportar um arquivo de 5 MB e os campos do formulário. O envio armazena a imagem; selecione-a no conteúdo, serviço ou profissional para publicá-la.

Substitua o apoio abstrato por arquivos oficiais quando estiverem disponíveis. Não use prints do Instagram como acervo final sem os originais e a autorização correspondente.

## Backup e restauração

Para a demonstração local, pare o servidor e execute:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup-local.ps1
```

O pacote inclui o estado local completo do D1 e R2, as migrações e o ativo de apoio. Restaurar exige confirmação explícita e cria uma cópia do estado atual antes da troca:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restore-local.ps1 -Archive backups/nexius-demo-AAAA-MM-DD-HHMMSS.zip -ConfirmRestore
```

Em produção, o backup é completo somente quando combina a exportação do D1 com todos os objetos R2 e seus metadados. Teste a restauração em homologação; não valide uma cópia apenas pela existência do arquivo.

`node scripts/verify-backup.mjs before` registra os hashes antes do backup; depois de restaurar e reiniciar, `node scripts/verify-backup.mjs after` compara reservas, catálogo, políticas e arquivos. Restauração move o estado anterior para `backups/pre-restore`, permitindo recuperação. O script restaura D1/R2; migrações e ativo visual no ZIP são cópias de referência e não sobrescrevem o código da aplicação. Ao restaurar um backup antigo, execute `npm run db:migrate` antes de abrir a agenda.

## Migração da agenda atual

A importação real não é automática. O fluxo planejado é:

1. obter exportação autorizada das reservas futuras;
2. mapear profissionais e serviços;
3. gerar prévia sem gravação;
4. validar duplicidades, horários e conflitos;
5. importar com origem identificada e chave idempotente;
6. conciliar as duas agendas;
7. definir a data em que o novo portal passa a ser a única fonte oficial.

Não acessar contas, importar clientes ou interromper o sistema atual sem autorização específica.

Há uma prévia **sem gravação** em `scripts/preview-import.mjs`:

```powershell
node scripts/preview-import.mjs exportacao-autorizada.json
```

O JSON contém `source`, `rows` (`externalId`, `professional`, `services`, `startAt` com fuso explícito), mapas `serviceMap`/`professionalMap`, `catalog` atual e `existing` (reservas existentes). A prévia detecta mapeamentos ausentes, referências repetidas e sobreposição entre linhas/reservas. Linhas sem esses problemas ainda exigem conferência da disponibilidade completa. Não existe importação real habilitada: isso depende de exportação autorizada, conciliação e plano de corte.

## Ativo visual e pendências de marca

Foi usado ImageGen apenas para uma composição abstrata: concreto escuro, linhas em X e luz roxa, sem texto, logos, pessoas ou salão. Resultado utilizado: `public/nexius-concrete-x.png`. A identificação tipográfica é provisória; não é uma reconstrução da logo oficial. As fotos e o arquivo original de logo devem ser enviados pelo proprietário. As galerias só aparecem quando recebem imagens autorizadas pelo painel.

## Roteiro de apresentação

1. Abrir a home no celular e mostrar a nova presença preta, branca e roxa.
2. Entrar em `/agendar`, buscar um serviço e concluir uma reserva de demonstração.
3. Abrir `/gestao` e localizar a reserva na agenda; mostrar bloqueio e catálogo.
4. Abrir `/cliente`, remarcar e confirmar a mudança refletida no painel.
5. Abrir `/profissional` e mostrar a agenda limitada ao profissional.
6. Encerrar com a lista de dados pendentes e o plano de transição da agenda atual.

O benefício demonstrável é reunir marca e operação em uma experiência própria. Aquisição, conversão ou crescimento só podem ser medidos depois de uma publicação real; este projeto não faz promessas numéricas.
