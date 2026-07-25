const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SPECIAL = '!@#$%&*?';

function cryptoRandom(max: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0]! % max;
}

function pick(charset: string): string {
  return charset[cryptoRandom(charset.length)]!;
}

export function generateSecurePassword(length = 8): string {
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];

  const all = UPPER + LOWER + DIGITS + SPECIAL;
  while (required.length < length) {
    required.push(pick(all));
  }

  for (let i = required.length - 1; i > 0; i--) {
    const j = cryptoRandom(i + 1);
    [required[i], required[j]] = [required[j]!, required[i]!];
  }

  return required.join('');
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
