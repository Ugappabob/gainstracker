import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'athlete' | 'coach';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  /** If set, this athlete's data may be read by the coach with this uid. */
  coachId: string | null;
}

export interface Exercise {
  id: string;
  name: string;
}

export interface TemplateLine {
  exerciseId: string;
  exerciseName: string;
  defaultSets: { reps: number; weight: number }[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  lines: TemplateLine[];
}

export type WorkoutStatus = 'in_progress' | 'completed';

export interface Workout {
  id: string;
  ownerUid: string;
  status: WorkoutStatus;
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  templateId: string | null;
  location: string | null;
  title: string | null;
}

export interface WorkoutLine {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  sets: { reps: number; weight: number }[];
}

export interface ExerciseHistoryEntry {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName?: string;
  workoutId: string;
  completedAt: Timestamp;
  sets: { reps: number; weight: number }[];
}
