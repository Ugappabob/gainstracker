import { useMemo, useState } from 'react';
import type { Exercise } from '@/types/models';
import { customExerciseIdFromName } from '@/utils/customExerciseId';

type Props = {
  exercises: Exercise[];
  disabled?: boolean;
  onPick: (exerciseId: string, exerciseName: string) => void;
};

export default function ExercisePicker({ exercises, disabled, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((e) => e.name.toLowerCase().includes(q));
  }, [exercises, query]);

  const pickCustom = () => {
    const name = customName.trim();
    if (!name) return;
    onPick(customExerciseIdFromName(name), name);
    setCustomName('');
    setQuery('');
  };

  return (
    <div className="stack exercise-picker" style={{ gap: '0.65rem' }}>
      <label className="stack" style={{ gap: '0.25rem' }}>
        <span className="muted">Search library</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter exercises…"
          disabled={disabled}
          autoComplete="off"
        />
      </label>

      <div className="exercise-picker-list" role="listbox" aria-label="Exercise library">
        {filtered.length === 0 && <p className="muted" style={{ margin: 0 }}>No matches.</p>}
        {filtered.map((e) => (
          <button
            key={e.id}
            type="button"
            className="btn btn-ghost exercise-picker-item"
            disabled={disabled}
            onClick={() => {
              onPick(e.id, e.name);
              setQuery('');
            }}
          >
            {e.name}
          </button>
        ))}
      </div>

      <div className="stack" style={{ gap: '0.35rem' }}>
        <span className="muted">Or custom name</span>
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
          <label className="stack" style={{ flex: 1, minWidth: '10rem', gap: '0.25rem' }}>
            <span className="muted">Exercise name</span>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Paused bench"
              disabled={disabled}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  pickCustom();
                }
              }}
            />
          </label>
          <button type="button" className="btn btn-primary" disabled={disabled || !customName.trim()} onClick={pickCustom}>
            Add custom
          </button>
        </div>
      </div>
    </div>
  );
}
