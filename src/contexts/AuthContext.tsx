import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getDb, getFirebaseAuth } from '@/firebase/config';
import { isHeadCoachEmail } from '@/constants/coach';
import { ensureHeadCoachConfig, fetchHeadCoachUid } from '@/services/headCoachConfig';
import type { UserProfile } from '@/types/models';

type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
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
  const profile: Omit<UserProfile, 'uid'> = headCoach
    ? {
        email: user.email,
        displayName: user.displayName,
        role: 'coach',
        coachId: null,
      }
    : {
        email: user.email,
        displayName: user.displayName,
        role: 'athlete',
        coachId: await fetchHeadCoachUid(),
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
        const auth = getFirebaseAuth();
        await signInWithEmailAndPassword(auth, email, password);
      },
      signUp: async (email, password) => {
        const normalized = email.trim().toLowerCase();
        if (isHeadCoachEmail(normalized)) {
          const auth = getFirebaseAuth();
          const cred = await createUserWithEmailAndPassword(auth, normalized, password);
          const db = getDb();
          await setDoc(doc(db, 'users', cred.user.uid), {
            email: cred.user.email,
            displayName: cred.user.displayName,
            role: 'coach',
            coachId: null,
            createdAt: serverTimestamp(),
          });
          await ensureHeadCoachConfig(cred.user.uid);
          return;
        }
        const coachUid = await fetchHeadCoachUid();
        const auth = getFirebaseAuth();
        const cred = await createUserWithEmailAndPassword(auth, normalized, password);
        const db = getDb();
        await setDoc(doc(db, 'users', cred.user.uid), {
          email: cred.user.email,
          displayName: cred.user.displayName,
          role: 'athlete',
          coachId: coachUid,
          createdAt: serverTimestamp(),
        });
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
