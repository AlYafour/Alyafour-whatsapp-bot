import { formatRelativeTime, MODE_LABEL, STATUS_LABEL } from '../utils/format';

export default function ConversationListItem({ conversation, active, onClick }) {
  const label = conversation.customer_name || conversation.wa_id;

  return (
    <button type="button" className={`conv-item ${active ? 'conv-item--active' : ''}`} onClick={onClick}>
      <div className="conv-item__avatar">{label.charAt(0).toUpperCase()}</div>
      <div className="conv-item__body">
        <div className="conv-item__top">
          <span className="conv-item__name">{label}</span>
          <span className="conv-item__time">{formatRelativeTime(conversation.last_message_at)}</span>
        </div>
        <div className="conv-item__bottom">
          <span className="conv-item__preview">{conversation.last_message_preview || '—'}</span>
          {conversation.unread_count > 0 && <span className="badge">{conversation.unread_count}</span>}
        </div>
        <div className="conv-item__tags">
          <span className={`tag tag--mode-${conversation.mode}`}>{MODE_LABEL[conversation.mode]}</span>
          <span className={`tag tag--status-${conversation.status}`}>{STATUS_LABEL[conversation.status]}</span>
        </div>
      </div>
    </button>
  );
}
