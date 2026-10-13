import { useEffect, useRef, useState, type FormEvent } from 'react';
import { connectAnna, loadNotes, saveNotes, type AnnaConnection, type NotesState } from './anna';
import { errorMessage, summarizeNotes } from './summary';

export default function App() {
  const anna = useRef<AnnaConnection | null>(null);
  const [state, setState] = useState<NotesState>({ nextOrder: 1, notes: [] });
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');

  useEffect(() => {
    let active = true;
    connectAnna().then(async (connection) => {
      const saved = await loadNotes(connection);
      if (active) { anna.current = connection; setState(saved); }
    }).catch((e) => { if (active) setError(errorMessage(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!anna.current || busy || !draft.trim()) return;
    const next = {
      nextOrder: state.nextOrder + 1,
      notes: [...state.notes, { id: crypto.randomUUID(), content: draft.trim(), order: state.nextOrder }],
    };
    setBusy(true); setError('');
    try {
      await saveNotes(anna.current, next);
      setState(next); setDraft(''); setSummary('');
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  async function deleteNote(id: string) {
    if (!anna.current || busy) return;
    const previous = state;
    const next = { ...state, notes: state.notes.filter((n) => n.id !== id) };
    setState(next); setBusy(true); setError('');
    try { await saveNotes(anna.current, next); setSummary(''); }
    catch (e) { setState(previous); setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  async function summarize() {
    if (!anna.current || busy || !state.notes.length) return;
    setBusy(true); setError(''); setSummary('');
    try { setSummary(await summarizeNotes(anna.current, state.notes)); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  const disabled = loading || busy || !anna.current;
  return (
    <main className="notebook">
      <header>
        <p className="eyebrow">A LITTLE SPACE TO THINK</p>
        <h1>Mini Notes<span className="title-dot">.</span></h1>
        <p className="subtitle">Catch a thought. Make room for the next one.</p>
      </header>

      <form onSubmit={addNote} className="composer">
        <label htmlFor="note-content">What’s on your mind?</label>
        <textarea id="note-content" value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="A follow-up, a small fix, an idea worth keeping…" rows={3} disabled={disabled} />
        <div className="composer-actions">
          <span>One thought at a time.</span>
          <button className="primary" type="submit" disabled={disabled || !draft.trim()}>Save note <span aria-hidden="true">↗</span></button>
        </div>
      </form>

      {error && <div role="alert" className="error"><strong>Couldn’t finish that.</strong><p>{error}</p>
        {error.includes('--no-llm') && <p>Summarizing is unavailable in this local no-LLM session. Your notes are still available.</p>}
      </div>}

      <section aria-labelledby="notes-heading" className="notes-section">
        <div className="section-heading">
          <h2 id="notes-heading">Your notes <span className="count">{state.notes.length}</span></h2>
          <button type="button" onClick={summarize} disabled={disabled || !state.notes.length}>Summarize <span aria-hidden="true">✦</span></button>
        </div>
        {loading ? <p role="status" className="empty">Opening your notebook…</p> : state.notes.length === 0 ?
          <div className="empty"><span className="empty-mark" aria-hidden="true">＋</span><p>A fresh page.</p><span>Add your first note above.</span></div> :
          <ol className="notes-list">{state.notes.map((note) => <li key={note.id} className="note">
            <span className="note-order" aria-label={`Note ${note.order}`}>{String(note.order).padStart(2, '0')}</span>
            <p>{note.content}</p>
            <button className="delete" type="button" onClick={() => deleteNote(note.id)} disabled={disabled} aria-label={`Delete note ${note.order}`}>×</button>
          </li>)}</ol>}
      </section>

      {busy && <p role="status" className="activity">Working on it…</p>}
      {summary && <section className="summary" aria-labelledby="summary-heading"><p className="eyebrow">THE BIG PICTURE</p><h2 id="summary-heading">Your summary</h2><p>{summary}</p></section>}
      <footer>Small thoughts, kept together.</footer>
    </main>
  );
}
