import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { connectAnna, STORAGE_KEY, TOOL_ID, type AnnaConnection } from './anna';

vi.mock('./anna', async (load) => {
  const original = await load<typeof import('./anna')>();
  return { ...original, connectAnna: vi.fn() };
});

let anna: AnnaConnection;
beforeEach(() => {
  anna = {
    storage: { get: vi.fn().mockResolvedValue({ value: null }), set: vi.fn().mockResolvedValue({ ok: true }) },
    tools: { invoke: vi.fn().mockResolvedValue({ result: { success: true, data: { summary: 'From the host LLM' } } }) },
  };
  vi.mocked(connectAnna).mockResolvedValue(anna);
});
afterEach(cleanup);

async function open() {
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('What’s on your mind?').hasAttribute('disabled')).toBe(false));
}
async function add(text: string) {
  fireEvent.change(screen.getByLabelText('What’s on your mind?'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /Save note/ }));
  await screen.findByText(text.trim());
}

describe('Mini Notes host wiring', () => {
  it('rejects empty drafts, saves through storage, clears input and keeps monotonically increasing order', async () => {
    await open();
    expect(anna.storage.get).toHaveBeenCalledWith({ key: STORAGE_KEY });
    expect(screen.getByRole('button', { name: /Save note/ }).hasAttribute('disabled')).toBe(true);
    await add('  First note  ');
    await waitFor(() => expect((screen.getByLabelText('What’s on your mind?') as HTMLTextAreaElement).value).toBe(''));
    await add('Second note');
    fireEvent.click(screen.getByRole('button', { name: 'Delete note 1' }));
    await waitFor(() => expect(screen.queryByText('First note')).toBeNull());
    await add('Third note');
    const state = vi.mocked(anna.storage.set).mock.calls.at(-1)![0].value;
    expect(state.notes.map((n) => n.order)).toEqual([2, 3]);
    expect(state.nextOrder).toBe(4);
  });

  it('keeps a failed draft and rolls back a failed optimistic deletion', async () => {
    await open();
    vi.mocked(anna.storage.set).mockRejectedValueOnce(new Error('Write unavailable'));
    fireEvent.change(screen.getByLabelText('What’s on your mind?'), { target: { value: 'Keep this draft' } });
    fireEvent.click(screen.getByRole('button', { name: /Save note/ }));
    await screen.findByText('Write unavailable');
    expect((screen.getByLabelText('What’s on your mind?') as HTMLTextAreaElement).value).toBe('Keep this draft');
    expect(screen.queryByRole('button', { name: 'Delete note 1' })).toBeNull();
    await add('Saved note');
    vi.mocked(anna.storage.set).mockRejectedValueOnce(new Error('Delete unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete note 1' }));
    await screen.findByText('Delete unavailable');
    expect(screen.getByText('Saved note')).toBeTruthy();
  });

  it('invokes only the declared tool and renders the host response or no-LLM error', async () => {
    await open();
    await add('Follow up with the client');
    fireEvent.click(screen.getByRole('button', { name: /Summarize/ }));
    await screen.findByText('From the host LLM');
    expect(anna.tools.invoke).toHaveBeenCalledWith({ tool_id: TOOL_ID, method: 'summarize', args: { text: '1. Follow up with the client' } });
    vi.mocked(anna.tools.invoke).mockRejectedValueOnce(new Error('[-32603] harness started with --no-llm'));
    fireEvent.click(screen.getByRole('button', { name: /Summarize/ }));
    await screen.findByText('[-32603] harness started with --no-llm');
    expect(screen.queryByText('From the host LLM')).toBeNull();
  });
});
