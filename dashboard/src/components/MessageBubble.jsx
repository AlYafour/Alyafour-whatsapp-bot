import { formatClock, MESSAGE_TYPE_LABEL } from '../utils/format';

const STATUS_ICON = { received: '', sent: '✓', delivered: '✓✓', read: '✓✓', failed: '⚠' };

export default function MessageBubble({ message }) {
  const isOutbound = message.direction === 'outbound';
  const senderLabel = message.sender_type === 'agent' ? 'موظف' : message.sender_type === 'bot' ? 'بوت' : null;
  const body = message.text || (message.message_type !== 'text' ? `[${MESSAGE_TYPE_LABEL[message.message_type] || message.message_type}]` : '');

  return (
    <div className={`bubble-row ${isOutbound ? 'bubble-row--out' : 'bubble-row--in'}`}>
      <div className={`bubble bubble--${message.sender_type}`}>
        {senderLabel && <div className="bubble__sender">{senderLabel}</div>}
        <div className="bubble__text">{body}</div>
        <div className="bubble__meta">
          <span>{formatClock(message.created_at)}</span>
          {isOutbound && (
            <span className={`bubble__status bubble__status--${message.status}`}>{STATUS_ICON[message.status] || ''}</span>
          )}
        </div>
      </div>
    </div>
  );
}
