import { scrypt, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

// OWASP scrypt profile: N=2^15, r=8, p=3 (32 MiB). Never store the password.
export function derivePassword(
  password: string,
  salt: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      32,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function verifyPassword(password: string, encoded: string) {
  const [scheme, salt, expected] = encoded.split('$');
  if (
    scheme !== 'scrypt-v1' ||
    !/^[a-f0-9]{32}$/.test(salt || '') ||
    !/^[a-f0-9]{64}$/.test(expected || '')
  )
    return false;
  const actual = await derivePassword(password, salt);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
