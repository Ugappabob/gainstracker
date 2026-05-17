/** Stable id for a user-typed exercise; prefix avoids collisions with library `ex_*` ids. */
export function customExerciseIdFromName(rawName: string): string {
  const slug = rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return `c_${slug || 'exercise'}`;
}

export function labelFromCustomExerciseId(exerciseId: string): string {
  if (!exerciseId.startsWith('c_')) return exerciseId;
  return exerciseId
    .slice(2)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
