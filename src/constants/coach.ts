/** Only this account may be coach; all athletes are linked to their roster. */
export const HEAD_COACH_EMAIL = 'stevenfhulett@gmail.com';

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function isHeadCoachEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email) === HEAD_COACH_EMAIL;
}

export function isHeadCoachProfile(
  profile: { email?: string | null; role?: string } | null,
  authEmail?: string | null,
): boolean {
  if (profile?.role !== 'coach') return false;
  return isHeadCoachEmail(profile.email) || isHeadCoachEmail(authEmail);
}
