// ============================================================================
// AICTE COMPLAINT INTELLIGENCE HUB — PERSISTENT TRANSACTIONAL REPOSITORY
// Server-side persistent store with transparent Supabase / Local SQL-equivalent status
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { createInitialSeedState } from './seedData';
import { DatabaseState } from './types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'aicte_hub_db.json');

let memoryState: DatabaseState | null = null;

export function getDatabaseState(): DatabaseState {
  if (memoryState) return memoryState;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      memoryState = JSON.parse(raw) as DatabaseState;
      return memoryState;
    }
  } catch (err) {
    console.warn('Initializing fresh demonstration seed state:', err);
  }

  memoryState = createInitialSeedState();
  persistDatabaseState(memoryState);
  return memoryState;
}

export function persistDatabaseState(state: DatabaseState): void {
  memoryState = state;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist state to disk:', err);
  }
}

export function resetToInitialSeedState(): DatabaseState {
  const fresh = createInitialSeedState();
  persistDatabaseState(fresh);
  return fresh;
}
