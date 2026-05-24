import { doc, updateDoc } from 'firebase/firestore';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getDb } from '@/firebase/config';
import type { UserProfile } from '@/types/models';

export async function listRosterAthletes(coachUid: string): Promise<UserProfile[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), 'users'),
      where('coachId', '==', coachUid),
      where('role', '==', 'athlete'),
    ),
  );
  return snap.docs
    .map((d) => {
      const x = d.data() as Omit<UserProfile, 'uid'>;
      return { uid: d.id, ...x };
    })
    .sort((a, b) => {
      const na = (a.displayName || a.email || a.uid).toLowerCase();
      const nb = (b.displayName || b.email || b.uid).toLowerCase();
      return na.localeCompare(nb);
    });
}

export async function updateUserDisplayName(uid: string, displayName: string | null): Promise<void> {
  const trimmed = displayName?.trim() ?? '';
  await updateDoc(doc(getDb(), 'users', uid), {
    displayName: trimmed.length > 0 ? trimmed : null,
  });
}
