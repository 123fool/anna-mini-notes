import { AnnaAppRuntime } from '@anna-ai/app-runtime';

export const TOOL_ID = 'tool-mini-notes-summarizer-local';
export const STORAGE_KEY = 'mini-notes';

export interface Note {
  id: string;
  content: string;
  order: number;
}

export interface NotesState {
  nextOrder: number;
  notes: Note[];
}

export interface AnnaConnection {
  storage: {
    get(args: { key: string }): Promise<{ value: unknown }>;
    set(args: { key: string; value: NotesState }): Promise<unknown>;
  };
  tools: {
    invoke(args: { tool_id: string; method: string; args: { text: string } }): Promise<{
      summary: string;
    }>;
  };
}

let connection: Promise<AnnaConnection> | undefined;

export function connectAnna(): Promise<AnnaConnection> {
  connection ??= AnnaAppRuntime.connect();
  return connection;
}

export async function loadNotes(anna: AnnaConnection): Promise<NotesState> {
  const { value } = await anna.storage.get({ key: STORAGE_KEY });
  if (value == null) return { nextOrder: 1, notes: [] };
  // Storage is a host boundary. Reject malformed data instead of silently losing notes.
  const state = value as Partial<NotesState>;
  if (!Number.isSafeInteger(state.nextOrder) || (state.nextOrder ?? 0) < 1 ||
      !Array.isArray(state.notes) || !state.notes.every((n) =>
        typeof n.id === 'string' && typeof n.content === 'string' && Number.isSafeInteger(n.order))) {
    throw new Error('Saved notes have an invalid format. They were not overwritten.');
  }
  return state as NotesState;
}

export async function saveNotes(anna: AnnaConnection, state: NotesState): Promise<void> {
  await anna.storage.set({ key: STORAGE_KEY, value: state });
}
