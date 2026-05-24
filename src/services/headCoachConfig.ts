import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getDb } from '@/firebase/config';
import { HEAD_COACH_EMAIL } from '@/constants/coach';
import { generateInviteCode, normalizeInviteCode } from '@/utils/inviteCode';

const configRef = () => doc(getDb(), 'config', 'headCoach');

export type HeadCoachConfig = {
  uid: string;
  email: string;
  signupCode?: string;
  signupEnabled?: boolean;
};

export type InviteSettings = {
  code: string;
  enabled: boolean;
  inviteUrl: string;
};

/** Firebase UID of the sole coach (stevenfhulett@gmail.com). */
export async function fetchHeadCoachUid(): Promise<string> {
  const snap = await getDoc(configRef());
  if (!snap.exists()) {
    throw new Error('Coach setup is incomplete. The head coach must sign in once first.');
  }
  const uid = (snap.data() as HeadCoachConfig).uid;
  if (!uid) throw new Error('Invalid coach configuration.');
  return uid;
}

export async function fetchHeadCoachConfig(): Promise<HeadCoachConfig | null> {
  const snap = await getDoc(configRef());
  if (!snap.exists()) return null;
  return snap.data() as HeadCoachConfig;
}

/** Validates invite before account creation (works while signed out). */
export async function assertInviteCodeValid(code: string): Promise<void> {
  const normalized = normalizeInviteCode(code);
  if (!normalized) throw new Error('Invite code is required.');

  const config = await fetchHeadCoachConfig();
  if (!config?.uid) {
    throw new Error('Coach setup is incomplete. Ask your coach to sign in once first.');
  }
  if (config.signupEnabled === false) {
    throw new Error('Sign-ups are paused. Ask your coach for access.');
  }
  if (!config.signupCode) {
    throw new Error('Sign-ups are not open yet. Ask your coach to create an invite.');
  }
  if (normalized !== normalizeInviteCode(config.signupCode)) {
    throw new Error('Invalid invite code.');
  }
}

/** Head coach writes their UID once so athlete sign-up can link to the roster. */
export async function ensureHeadCoachConfig(coachUid: string): Promise<void> {
  const snap = await getDoc(configRef());
  if (snap.exists()) return;
  await setDoc(configRef(), {
    uid: coachUid,
    email: HEAD_COACH_EMAIL,
    signupCode: generateInviteCode(),
    signupEnabled: true,
  });
}

/** Ensures an invite code exists; returns current invite settings for the coach UI. */
export async function ensureInviteSettings(): Promise<InviteSettings> {
  const snap = await getDoc(configRef());
  if (!snap.exists()) {
    throw new Error('Coach config missing. Sign in again as head coach.');
  }
  const data = snap.data() as HeadCoachConfig;
  let code = data.signupCode ? normalizeInviteCode(data.signupCode) : '';
  if (!code) {
    code = generateInviteCode();
    await updateDoc(configRef(), { signupCode: code, signupEnabled: true });
  }
  const enabled = data.signupEnabled !== false;
  return { code, enabled, inviteUrl: inviteLoginUrlFromCode(code) };
}

function inviteLoginUrlFromCode(code: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/login?invite=${encodeURIComponent(code)}`;
}

export async function rotateSignupCode(): Promise<InviteSettings> {
  const code = generateInviteCode();
  await updateDoc(configRef(), { signupCode: code, signupEnabled: true });
  return { code, enabled: true, inviteUrl: inviteLoginUrlFromCode(code) };
}

export async function setSignupEnabled(enabled: boolean): Promise<void> {
  await updateDoc(configRef(), { signupEnabled: enabled });
}
