import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb } from '@/firebase/config';

const configRef = () => doc(getDb(), 'config', 'headCoach');

/** Firebase UID of the sole coach (stevenfhulett@gmail.com). */
export async function fetchHeadCoachUid(): Promise<string> {
  const snap = await getDoc(configRef());
  if (!snap.exists()) {
    throw new Error('Coach setup is incomplete. The head coach must sign in once first.');
  }
  const uid = (snap.data() as { uid?: string }).uid;
  if (!uid) throw new Error('Invalid coach configuration.');
  return uid;
}

/** Head coach writes their UID once so athlete sign-up can link to the roster. */
export async function ensureHeadCoachConfig(coachUid: string): Promise<void> {
  const snap = await getDoc(configRef());
  if (snap.exists()) return;
  await setDoc(configRef(), { uid: coachUid, email: 'stevenfhulett@gmail.com' });
}
