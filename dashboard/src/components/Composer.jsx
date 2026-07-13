import { useState } from 'react';

export default function Composer({ disabled, disabledReason, onSend }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      await onSend(text.trim());
      setText('');
    } catch (err) {
      setError(err.message || 'تعذر إرسال الرسالة');
    } finally {
      setSending(false);
    }
  }

  if (disabled) {
    return (
      <div className="composer composer--disabled">
        <span>{disabledReason}</span>
      </div>
    );
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer__row">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب ردك هنا…"
          maxLength={4096}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e);
          }}
        />
        <button type="submit" className="btn btn--primary" disabled={sending || !text.trim()}>
          {sending ? '...' : 'إرسال'}
        </button>
      </div>
      {error && <div className="composer__error">{error}</div>}
    </form>
  );
}
