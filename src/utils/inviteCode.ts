const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function generateInviteCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

export function inviteLoginUrl(code: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/login?invite=${encodeURIComponent(normalizeInviteCode(code))}`;
}
