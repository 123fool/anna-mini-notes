import { TOOL_ID, type AnnaConnection, type Note } from './anna';

export async function summarizeNotes(anna: AnnaConnection, notes: Note[]): Promise<string> {
  const text = [...notes].sort((a, b) => a.order - b.order)
    .map((note) => `${note.order}. ${note.content}`).join('\n');
  const { result } = await anna.tools.invoke({ tool_id: TOOL_ID, method: 'summarize', args: { text } });
  if (!result.success || typeof result.data?.summary !== 'string') {
    throw new Error(result.error || 'The tool did not return a summary.');
  }
  return result.data.summary;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
