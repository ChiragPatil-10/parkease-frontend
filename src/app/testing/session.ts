import { UserRole } from '../models/auth/user-role.enum';

export const SESSION_STORAGE_KEY = 'parkease.session';

/** Builds an unsigned JWT-shaped string whose exp claim is `expiresInSeconds` from now. */
export function makeToken(expiresInSeconds: number): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return `${encode({ alg: 'none' })}.${encode({ exp })}.sig`;
}

export function storeSession(role: UserRole, accessToken = makeToken(3600)): void {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      accessToken,
      refreshToken: 'refresh-1',
      expiresAt: '2026-01-01T00:00:00Z',
      user: {
        userId: '1',
        fullName: 'Test User',
        email: 'test@example.com',
        role,
        profilePicUrl: null,
      },
    }),
  );
}
