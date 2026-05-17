import { writeBatch, type DocumentReference } from 'firebase/firestore';
import { getDb } from '@/firebase/config';

const CHUNK = 400;

/** Firestore batches cap at 500 operations; delete in chunks. */
export async function deleteDocumentRefsInChunks(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(getDb());
    for (const r of refs.slice(i, i + CHUNK)) {
      batch.delete(r);
    }
    await batch.commit();
  }
}
