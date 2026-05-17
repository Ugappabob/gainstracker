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
    .sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''));
}
