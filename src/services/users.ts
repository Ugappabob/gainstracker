import { collection, doc, getDocs, limit, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { getDb } from '@/firebase/config';
import type { RosterAthlete, UserProfile } from '@/types/models';
import type { Timestamp } from 'firebase/firestore';

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

async function fetchLastWorkoutAt(athleteUid: string): Promise<Timestamp | null> {
  const snap = await getDocs(
    query(
      collection(getDb(), 'workouts'),
      where('ownerUid', '==', athleteUid),
      orderBy('startedAt', 'desc'),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  const startedAt = snap.docs[0]!.data().startedAt as Timestamp | undefined;
  return startedAt ?? null;
}

export async function listRosterAthletesWithActivity(coachUid: string): Promise<RosterAthlete[]> {
  const athletes = await listRosterAthletes(coachUid);
  const withActivity = await Promise.all(
    athletes.map(async (a) => ({
      ...a,
      lastWorkoutAt: await fetchLastWorkoutAt(a.uid),
    })),
  );
  return withActivity.sort((a, b) => {
    const ta = a.lastWorkoutAt?.toMillis?.() ?? 0;
    const tb = b.lastWorkoutAt?.toMillis?.() ?? 0;
    if (tb !== ta) return tb - ta;
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

export async function updateAthleteCoachNotes(athleteUid: string, coachNotes: string | null): Promise<void> {
  const trimmed = coachNotes?.trim() ?? '';
  await updateDoc(doc(getDb(), 'users', athleteUid), {
    coachNotes: trimmed.length > 0 ? trimmed : null,
  });
}

/** Unlinks athlete from coach roster; their account and workout data remain. */
export async function removeAthleteFromRoster(athleteUid: string): Promise<void> {
  await updateDoc(doc(getDb(), 'users', athleteUid), {
    coachId: null,
    coachNotes: null,
  });
}
