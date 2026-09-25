'use client';
import { useState } from 'react';
import { LockKeyhole, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function StaffLogin({ configured, managed = false }: { configured: boolean; managed?: boolean }) {
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <main className="staff-login">
      <a className="wordmark" href="/">
        NE<span>X</span>IUS <small>BARBER</small>
      </a>
      <section className="login-card">
        <span className="login-icon">
          <LockKeyhole />
        </span>
        <p className="eyebrow">ÁREA DA EQUIPE</p>
        <h1>
          Sua agenda.
          <br />
          <em>Sob controle.</em>
        </h1>
        <p>Entre para acompanhar o dia e cuidar da operação.</p>
        {!configured && (
          <div className="login-setup" role="status">
            {managed ? 'O responsável precisa configurar o acesso da equipe no provedor antes de entrar.' : <>O primeiro acesso ainda não foi configurado. No computador do projeto, abra <strong>CONFIGURAR-ACESSO.cmd</strong> e escolha seu usuário e uma senha. Não existe senha padrão.</>}
          </div>
        )}
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try {
              const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
              });
              const data = (await response.json()) as { error?: string };
              if (!response.ok)
                throw new Error(data.error || 'Não foi possível entrar.');
              window.location.assign('/gestao');
            } catch (caught) {
              setError(
                caught instanceof Error ? caught.message : 'Falha ao entrar.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {managed ? 'E-mail da equipe' : 'Usuário'}
            <Input
              autoComplete="username"
              autoCapitalize="none"
              required
              maxLength={80}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            Senha
            <span className="password-field">
              <Input
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                required
                maxLength={256}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff /> : <Eye />}
              </button>
            </span>
          </label>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <Button size="lg" disabled={busy || !configured} type="submit">
            {busy ? 'Entrando…' : 'Entrar na gestão'}
            <ArrowRight />
          </Button>
        </form>
        <small>
          Esqueceu a senha? O responsável pelo sistema pode redefini-la. Nunca
          envie sua senha por WhatsApp.
        </small>
      </section>
      <a href="/agendar">Sou cliente, quero agendar ↗</a>
    </main>
  );
}

export function SignOutButton({ guest = false }: { guest?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <span>
      <button
        className="logout-button"
        disabled={busy}
        onClick={async () => {
          if (
            guest &&
            !confirm(
              'Encerrar o acesso neste aparelho? Para recuperar reservas em outro aparelho, fale com a barbearia.',
            )
          )
            return;
          setBusy(true);
          setError('');
          try {
            const response = await fetch('/api/session', { method: 'DELETE' });
            if (!response.ok) throw new Error();
            window.location.assign('/');
          } catch {
            setError('Não foi possível sair. Tente novamente.');
            setBusy(false);
          }
        }}
      >
        {busy ? 'Saindo…' : 'Sair'}
      </button>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
