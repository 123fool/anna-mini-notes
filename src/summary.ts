import { TOOL_ID, type AnnaConnection, type Note } from './anna';

export async function summarizeNotes(anna: AnnaConnection, notes: Note[]): Promise<string> {
  const text = [...notes].sort((a, b) => a.order - b.order)
    .map((note) => `${note.order}. ${note.content}`).join('\n');
  const result = await anna.tools.invoke({ tool_id: TOOL_ID, method: 'summarize', args: { text } });
  // The Anna dispatcher unwraps the Executa's success/data envelope.
  if (typeof result.summary !== 'string' || !result.summary.trim()) {
    throw new Error('The tool did not return a summary.');
  }
  return result.summary;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
