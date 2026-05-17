/**
 * One-off Excel → Firestore import (not part of the web app).
 *
 * Setup (once):
 *   1. Firebase Console → Project settings → Service accounts → Generate new private key
 *   2. Save as scripts/service-account.json (gitignored)
 *   3. set GOOGLE_APPLICATION_CREDENTIALS=c:\Users\steve\WorkoutTracker\scripts\service-account.json
 *
 * Usage:
 *   npm run import:workouts -- --dry-run --email stevenfhulett@gmail.com
 *   npm run import:workouts -- --email stevenfhulett@gmail.com
 *   npm run import:workouts -- --uid YOUR_FIREBASE_UID --file "path\to\file.xlsx"
 *   npm run import:workouts -- --email you@example.com --clear-owner
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import XLSX from 'xlsx';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { GoogleAuth } from 'google-auth-library';
import admin from 'firebase-admin';

const PROJECT_ID = 'gainstracker-fd8c9';
const DEFAULT_XLSX = String.raw`c:\Users\steve\Desktop\Python\Lifts Python\Workout_Parsed Cleaned.xlsx`;
const BATCH_LIMIT = 450;

function customExerciseIdFromName(rawName) {
  const slug = String(rawName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return `c_${slug || 'exercise'}`;
}

/** Handles M-D-YY and YYYY-M-D (e.g. 11-17-16 and 2023-8-31). */
function parseWorkoutDate(raw) {
  const parts = String(raw).trim().split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`Invalid date: ${raw}`);
  }
  let y;
  let m;
  let d;
  if (parts[0] >= 100) {
    [y, m, d] = parts;
  } else {
    [m, d] = parts;
    y = parts[2];
    if (y < 100) y = y >= 50 ? 1900 + y : 2000 + y;
  }
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) throw new Error(`Invalid date: ${raw}`);
  return dt;
}

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    clearOwner: false,
    email: null,
    uid: null,
    file: DEFAULT_XLSX,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--clear-owner') opts.clearOwner = true;
    else if (a === '--email') opts.email = argv[++i];
    else if (a === '--uid') opts.uid = argv[++i];
    else if (a === '--file') opts.file = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('Options: --dry-run --email <email> | --uid <uid> --file <xlsx> --clear-owner');
      process.exit(0);
    }
  }
  return opts;
}

function loadRows(filePath) {
  const abs = resolve(filePath);
  if (!existsSync(abs)) throw new Error(`File not found: ${abs}`);
  const wb = XLSX.readFile(abs);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function buildSessions(rows) {
  const sessionMap = new Map();

  for (const row of rows) {
    const dateRaw = row.Date;
    const location = String(row.Location ?? '').trim() || null;
    const lift = String(row.Lift ?? '').trim();
    const weight = Number(row.Weight);
    const reps = Number(row.Reps);

    if (!dateRaw || !lift) continue;
    if (!Number.isFinite(weight) || !Number.isFinite(reps)) {
      throw new Error(`Bad set row: ${JSON.stringify(row)}`);
    }

    const key = `${dateRaw}|${location ?? ''}`;
    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        date: parseWorkoutDate(dateRaw),
        location,
        exerciseOrder: [],
        exercises: new Map(),
      });
    }

    const session = sessionMap.get(key);
    if (!session.exercises.has(lift)) {
      session.exercises.set(lift, {
        exerciseName: lift,
        exerciseId: customExerciseIdFromName(lift),
        sets: [],
      });
      session.exerciseOrder.push(lift);
    }
    session.exercises.get(lift).sets.push({ weight, reps });
  }

  return [...sessionMap.values()]
    .map((s) => ({
      date: s.date,
      location: s.location,
      exercises: s.exerciseOrder.map((name) => s.exercises.get(name)),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Firebase CLI OAuth client (public, same as firebase-tools). */
const FIREBASE_CLI_CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function loadAuthorizedUserFromFirebaseCli() {
  const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!existsSync(configPath)) return null;
  const { tokens } = JSON.parse(readFileSync(configPath, 'utf8'));
  if (!tokens?.refresh_token) return null;
  return {
    type: 'authorized_user',
    client_id: FIREBASE_CLI_CLIENT_ID,
    client_secret: FIREBASE_CLI_CLIENT_SECRET,
    refresh_token: tokens.refresh_token,
  };
}

function initAdminForAuth() {
  if (admin.apps.length) return;
  const localKey = resolve('scripts/service-account.json');
  if (existsSync(localKey)) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(readFileSync(localKey, 'utf8'))),
      projectId: PROJECT_ID,
    });
    return;
  }
  const userCreds = loadAuthorizedUserFromFirebaseCli();
  if (userCreds) {
    admin.initializeApp({
      credential: admin.credential.refreshToken(userCreds),
      projectId: PROJECT_ID,
    });
    return;
  }
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

async function createFirestore() {
  const localKey = resolve('scripts/service-account.json');
  if (existsSync(localKey)) {
    console.log('Using scripts/service-account.json for Firestore.');
    return new Firestore({ projectId: PROJECT_ID, keyFilename: localKey });
  }
  const userCreds = loadAuthorizedUserFromFirebaseCli();
  if (userCreds) {
    console.log('Using credentials from firebase login (configstore) for Firestore.');
    const auth = new GoogleAuth({
      credentials: userCreds,
      scopes: ['https://www.googleapis.com/auth/datastore'],
    });
    return new Firestore({ projectId: PROJECT_ID, authClient: await auth.getClient() });
  }
  console.log('Trying application default credentials for Firestore…');
  return new Firestore({ projectId: PROJECT_ID });
}

async function resolveOwnerUid(opts) {
  if (opts.uid) return opts.uid;
  if (!opts.email) {
    throw new Error('Provide --email <address> or --uid <firebase-uid>');
  }
  initAdminForAuth();
  const user = await admin.auth().getUserByEmail(opts.email.trim().toLowerCase());
  return user.uid;
}

async function clearOwnerData(db, ownerUid) {
  console.log(`Clearing existing workouts for ${ownerUid}…`);
  const workoutsSnap = await db.collection('workouts').where('ownerUid', '==', ownerUid).get();
  let deleted = 0;

  for (const wDoc of workoutsSnap.docs) {
    const workoutId = wDoc.id;
    const histSnap = await db
      .collection('exerciseHistory')
      .where('userId', '==', ownerUid)
      .where('workoutId', '==', workoutId)
      .get();
    const linesSnap = await wDoc.ref.collection('lines').get();

    let batch = db.batch();
    let ops = 0;
    const flush = async () => {
      if (ops === 0) return;
      await batch.commit();
      batch = db.batch();
      ops = 0;
    };

    for (const d of histSnap.docs) {
      batch.delete(d.ref);
      ops++;
      if (ops >= BATCH_LIMIT) await flush();
    }
    for (const d of linesSnap.docs) {
      batch.delete(d.ref);
      ops++;
      if (ops >= BATCH_LIMIT) await flush();
    }
    batch.delete(wDoc.ref);
    ops++;
    await flush();
    deleted++;
    if (deleted % 50 === 0) console.log(`  cleared ${deleted}/${workoutsSnap.size} workouts`);
  }
  console.log(`Cleared ${deleted} workouts.`);
}

async function importSessions(db, ownerUid, sessions, dryRun) {
  let workouts = 0;
  let lines = 0;
  let history = 0;

  if (dryRun) {
    for (const session of sessions) {
      workouts++;
      lines += session.exercises.length;
      history += session.exercises.filter((e) => e.sets.length > 0).length;
    }
    return { workouts, lines, history };
  }

  let batch = db.batch();
  let batchOps = 0;

  const flush = async () => {
    if (batchOps === 0) return;
    await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  for (const session of sessions) {

    const workoutRef = db.collection('workouts').doc();
    const ts = Timestamp.fromDate(session.date);

    batch.set(workoutRef, {
      ownerUid,
      status: 'completed',
      startedAt: ts,
      completedAt: ts,
      templateId: null,
      location: session.location,
      title: null,
    });
    batchOps++;

    let order = 0;
    for (const ex of session.exercises) {
      const lineRef = workoutRef.collection('lines').doc();
      batch.set(lineRef, {
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        order: order++,
        sets: ex.sets,
      });
      batchOps++;
      lines++;

      if (ex.sets.length > 0) {
        const histRef = db.collection('exerciseHistory').doc();
        batch.set(histRef, {
          userId: ownerUid,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          workoutId: workoutRef.id,
          completedAt: ts,
          sets: ex.sets,
        });
        batchOps++;
        history++;
      }

      if (batchOps >= BATCH_LIMIT) await flush();
    }

    workouts++;
    if (workouts % 100 === 0) console.log(`  imported ${workouts}/${sessions.length} sessions…`);
    if (batchOps >= BATCH_LIMIT) await flush();
  }

  await flush();
  return { workouts, lines, history };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log('Reading', opts.file);
  const rows = loadRows(opts.file);
  console.log(`Loaded ${rows.length} set rows`);

  const sessions = buildSessions(rows);
  const setCount = sessions.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
  const first = sessions[0]?.date.toISOString().slice(0, 10);
  const last = sessions[sessions.length - 1]?.date.toISOString().slice(0, 10);
  console.log(`Sessions: ${sessions.length} (${first} → ${last}), sets: ${setCount}`);

  if (opts.dryRun) {
    const counts = await importSessions(null, opts.uid ?? 'dry-run', sessions, true);
    console.log(`Dry run — would create: ${counts.workouts} workouts, ${counts.lines} lines, ${counts.history} history rows`);
    return;
  }

  const ownerUid = await resolveOwnerUid(opts);
  console.log(`Owner UID: ${ownerUid}`);

  const db = await createFirestore();

  if (opts.clearOwner) {
    await clearOwnerData(db, ownerUid);
  }

  console.log('Importing…');
  const result = await importSessions(db, ownerUid, sessions, false);
  console.log(`Done: ${result.workouts} workouts, ${result.lines} lines, ${result.history} history entries.`);
  console.log('Check History and Trends in the app (hard refresh if needed).');
}

main().catch((err) => {
  console.error(err.message || err);
  if (String(err.message).includes('Could not load the default credentials')) {
    console.error('\nSet GOOGLE_APPLICATION_CREDENTIALS to your service account JSON, e.g.:');
    console.error('  set GOOGLE_APPLICATION_CREDENTIALS=c:\\Users\\steve\\WorkoutTracker\\scripts\\service-account.json');
  }
  process.exit(1);
});
