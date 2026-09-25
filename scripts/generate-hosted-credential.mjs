import { randomBytes, scryptSync } from 'node:crypto';

const username = process.argv[2]?.trim().toLowerCase() || 'gabriel';
if (!/^[a-z0-9._-]{3,80}$/.test(username)) {
  throw new Error('Informe um nome de usuário válido.');
}

const password = randomBytes(18).toString('base64url');
const salt = randomBytes(16).toString('hex');
const passwordHash = `scrypt-v1$${salt}$${scryptSync(password, salt, 32, {
  N: 32768,
  r: 8,
  p: 3,
  maxmem: 64 * 1024 * 1024,
}).toString('hex')}`;

process.stdout.write(JSON.stringify({ username, password, passwordHash }));
