'use client';
import '@/app/account.css';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function AccountContact() {
  const [account, setAccount] = useState({
      id: '',
      name: '',
      phone: '',
      email: '',
    }),
    [message, setMessage] = useState(''),
    [working, setWorking] = useState(false);
  useEffect(() => {
    void fetch('/api/account')
      .then(async (response) => {
        const data = (await response.json()) as {
          account: typeof account;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error);
        setAccount({ ...data.account, phone: data.account.phone || '' });
      })
      .catch(() =>
        setMessage('Não foi possível carregar seu contato. Atualize a página.'),
      );
  }, []);
  return (
    <details className="account-contact">
      <summary>Meus dados de contato</summary>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setWorking(true);
          setMessage('');
          try {
            const response = await fetch('/api/account', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: account.name,
                phone: account.phone,
              }),
            });
            const data = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(data.error);
            setMessage(
              'Contato atualizado. Reservas anteriores preservam os dados registrados.',
            );
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : 'Falha ao salvar.',
            );
          } finally {
            setWorking(false);
          }
        }}
      >
        <label>
          Nome
          <Input
            required
            minLength={2}
            value={account.name}
            onChange={(event) =>
              setAccount({ ...account, name: event.target.value })
            }
          />
        </label>
        <label>
          Telefone
          <Input
            required
            type="tel"
            value={account.phone}
            onChange={(event) =>
              setAccount({ ...account, phone: event.target.value })
            }
          />
        </label>
        <p>Seu acesso fica protegido neste navegador por até 30 dias. O telefone é somente contato; não libera reservas em outro aparelho.</p>
        {!account.email.endsWith('.invalid') && <p>
          ID para vinculação pela gestão: <code>{account.id}</code>
        </p>}
        <Button disabled={working} type="submit">
          Salvar contato
        </Button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
