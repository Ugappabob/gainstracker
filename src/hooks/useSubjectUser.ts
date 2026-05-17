import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadCoachProfile } from '@/constants/coach';

/** Whose data to show: self, or an athlete when the head coach uses ?athlete=uid. */
export function useSubjectUser(): {
  subjectUid: string | null;
  isCoachView: boolean;
  loading: boolean;
} {
  const { user, profile, loading } = useAuth();
  const authEmail = user?.email ?? null;
  const [params] = useSearchParams();
  const athleteParam = params.get('athlete')?.trim() || null;

  if (loading || !user) {
    return { subjectUid: null, isCoachView: false, loading };
  }

  if (athleteParam && isHeadCoachProfile(profile, authEmail)) {
    return { subjectUid: athleteParam, isCoachView: true, loading: false };
  }

  return { subjectUid: user.uid, isCoachView: false, loading: false };
}
