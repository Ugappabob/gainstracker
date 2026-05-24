import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getDb, getFirebaseAuth } from '@/firebase/config';
import { isHeadCoachEmail } from '@/constants/coach';
import {
  assertInviteCodeValid,
  ensureHeadCoachConfig,
  fetchHeadCoachUid,
} from '@/services/headCoachConfig';
import { updateUserDisplayName } from '@/services/users';
import { normalizeInviteCode } from '@/utils/inviteCode';
import type { UserProfile } from '@/types/models';

type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, inviteCode?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function ensureUserProfile(user: User): Promise<UserProfile> {
  const db = getDb();
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const d = snap.data() as Omit<UserProfile, 'uid'>;
    return { uid: user.uid, ...d };
  }

  const headCoach = isHeadCoachEmail(user.email);
  if (!headCoach) {
    throw new Error('No account profile found. Sign up with an invite code from your coach.');
  }

  const profile: Omit<UserProfile, 'uid'> = {
    email: user.email,
    displayName: user.displayName,
    role: 'coach',
    coachId: null,
  };
  await setDoc(ref, { ...profile, createdAt: serverTimestamp() });
  return { uid: user.uid, ...profile };
}

async function afterAuth(user: User, profile: UserProfile): Promise<UserProfile> {
  if (isHeadCoachEmail(user.email) && profile.role === 'coach') {
    await ensureHeadCoachConfig(user.uid);
  }
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        let p = await ensureUserProfile(u);
        p = await afterAuth(u, p);
        setProfile(p);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      loading,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      },
      signUp: async (email, password, inviteCode) => {
        const normalized = email.trim().toLowerCase();
        if (isHeadCoachEmail(normalized)) {
          const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), normalized, password);
          await setDoc(doc(getDb(), 'users', cred.user.uid), {
            email: cred.user.email,
            displayName: cred.user.displayName,
            role: 'coach',
            coachId: null,
            createdAt: serverTimestamp(),
          });
          await ensureHeadCoachConfig(cred.user.uid);
          return;
        }

        await assertInviteCodeValid(inviteCode ?? '');
        const coachUid = await fetchHeadCoachUid();
        const invite = normalizeInviteCode(inviteCode ?? '');

        const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), normalized, password);
        await setDoc(doc(getDb(), 'users', cred.user.uid), {
          email: cred.user.email,
          displayName: cred.user.displayName,
          role: 'athlete',
          coachId: coachUid,
          inviteCode: invite,
          createdAt: serverTimestamp(),
        });
      },
      resetPassword: async (email) => {
        const normalized = email.trim().toLowerCase();
        if (!normalized) throw new Error('Enter your email address.');
        await sendPasswordResetEmail(getFirebaseAuth(), normalized);
      },
      updateDisplayName: async (displayName) => {
        if (!user) throw new Error('Not signed in.');
        const trimmed = displayName.trim();
        if (trimmed.length > 80) throw new Error('Display name is too long (max 80 characters).');
        await updateUserDisplayName(user.uid, trimmed.length > 0 ? trimmed : null);
        setProfile((prev) => (prev ? { ...prev, displayName: trimmed.length > 0 ? trimmed : null } : prev));
      },
      logOut: async () => {
        await signOut(getFirebaseAuth());
      },
    }),
    [user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
