# Hospedagem: caminho recomendado

Revisado em 22/09/2026. A demonstração está preparada para publicação no Sites com D1 e R2 isolados. Ela não substitui a agenda oficial e os dados operacionais ainda precisam ser aprovados pelo cliente.

Link de apresentação: `https://nexius-barber-demo.gabsilvanogueira.chatgpt.site`.

## Escolha

Para aproveitar o que já funciona: **Cloudflare Workers + D1 + R2**. O D1 guarda reservas, serviços, equipe e metadados; o R2 guarda as fotos. Fotos não são gravadas como grandes campos no banco.

- Workers Free possui franquia e limites por requisição. Não é capacidade ilimitada nem garantia de disponibilidade.
- D1 Free: até 500 MB por banco e 50 consultas por execução do Worker. A listagem de reservas agora usa uma consulta agregada, sem uma consulta por reserva.
- R2 Standard inclui 10 GB-mês, 1 milhão de operações classe A e 10 milhões classe B por mês. Uso excedente pode gerar cobrança; a ativação pode exigir forma de pagamento. Confira a tela de contratação e os alertas antes de ativar.
- Vercel Hobby é destinado a uso pessoal não comercial. Não é minha indicação gratuita para a operação de uma barbearia. Além disso, este projeto usa bindings D1/R2 do Worker; não funciona apenas enviando a pasta à Vercel.

Fontes: [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [limites D1](https://developers.cloudflare.com/d1/platform/limits/), [R2](https://developers.cloudflare.com/r2/pricing/), [Vercel Hobby](https://vercel.com/docs/plans/hobby).

## Login com senha no host gratuito

O Sites usa `AUTH_MODE=password` com uma credencial inicial guardada como hash scrypt nas variáveis seguras do ambiente. A senha em texto puro não fica no repositório. O usuário e a senha da demonstração devem ser entregues separadamente ao responsável.

Localmente, `AUTH_MODE=password` também valida a senha com scrypt (32 MiB; N=32768, r=8, p=3). Isso foi testado no runtime local. A verificação de uma senha forte consome CPU e não deve ser enfraquecida.

Para tentar operar dentro da franquia gratuita, foi preparado **`AUTH_MODE=supabase`**: somente a equipe entra com e-mail e senha no Supabase Auth; o servidor mantém a sessão própria HttpOnly e as permissões. Clientes continuam apenas com nome e telefone. Reservas e fotos continuam no D1/R2, não são migradas ao Supabase. A integração externa ainda precisa ser configurada e testada com sua conta.

No projeto Supabase do proprietário:

1. Configure autenticação por e-mail/senha e desative inscrição pública de usuários da equipe.
2. Crie/convide a conta do responsável e confirme o e-mail. O responsável define a senha; não a envie por chat.
3. Obtenha a URL do projeto e a chave publicável (ou anon). **Não use service_role.**
4. No Worker, configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `ADMIN_EMAILS` (lista exata de e-mails administrativos separados por vírgula).
5. Valide login correto/incorreto, logout, bloqueio de conta não autorizada e isolamento entre clientes na URL publicada.

A sessão administrativa dura até oito horas. Ao revogar imediatamente uma conta, revogue também suas linhas em `sessions` no D1 e remova o e-mail de `ADMIN_EMAILS`. A troca da senha no provedor não apaga automaticamente sessões próprias já emitidas pelo aplicativo.

O Supabase Free pode pausar projetos com baixa atividade após sete dias. Para uma agenda real, avalie esse risco e planeje custos se precisar de disponibilidade contínua. Não prometemos hospedagem gratuita para sempre. Fontes: [Auth por senha](https://supabase.com/docs/guides/auth/passwords), [pausa de projetos](https://supabase.com/docs/guides/platform/free-project-pausing), [preços](https://supabase.com/pricing).

## Preparar a demonstração externa

Os comandos abaixo **não foram executados contra uma conta externa**. Execute somente depois de conferir a conta, as condições dos planos e autorizar os recursos. Use um D1 e um bucket novos, exclusivos da demonstração, nunca a agenda oficial.

```powershell
npx.cmd wrangler login
npx.cmd wrangler d1 create nexius-demo
npx.cmd wrangler r2 bucket create nexius-demo-fotos
npm.cmd run build
node scripts/prepare-cloudflare.mjs ID_REAL_DO_D1 nexius-demo-fotos nexius-barber-demo
npx.cmd wrangler d1 migrations apply DB --remote --config wrangler.cloudflare.json
```

No painel do Worker ou com `wrangler secret put --config wrangler.cloudflare.json`, configure as três variáveis acima. A lista de e-mails é privada, apesar de a chave publicável não ser uma senha. Não coloque senha administrativa em `vars`, no Git ou no navegador.

```powershell
npx.cmd wrangler secret put SUPABASE_URL --config wrangler.cloudflare.json
npx.cmd wrangler secret put SUPABASE_PUBLISHABLE_KEY --config wrangler.cloudflare.json
npx.cmd wrangler secret put ADMIN_EMAILS --config wrangler.cloudflare.json
npx.cmd wrangler deploy --config wrangler.cloudflare.json
```

O gerador preserva `DEMO_MODE=true` e não copia o banco, as fotos, usuários, senhas ou sessões do computador. Não mexe em `.openai/hosting.json` nem no projeto Sites existente. Não execute deploy até os segredos estarem configurados; se a ferramenta exigir a criação inicial do Worker antes deles, mantenha-o sem rota pública enquanto configura o acesso no painel.

## Antes de reservas reais

Valide os dados da barbearia, políticas, funcionamento, número do WhatsApp, permissões, backup completo e conciliação da agenda antiga. Teste a URL hospedada, o consumo de CPU, o volume de consultas e o comportamento de falha dos provedores. Considere proteção antiautomação no agendamento público. Não basta trocar `DEMO_MODE` para `false`: a ativação oficial e a migração continuam exigindo validação operacional.
