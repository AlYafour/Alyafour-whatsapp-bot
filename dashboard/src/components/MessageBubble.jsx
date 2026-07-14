import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Download, MapPin, CornerUpLeft, AlertTriangle, RefreshCw, Check, CheckCheck } from 'lucide-react';
import AudioPlayer from './AudioPlayer';
import { formatClock, formatFileSize } from '../utils/format';
import { api } from '../api';

const STATUS_ICON = { sent: Check, delivered: CheckCheck, read: CheckCheck, failed: AlertTriangle };

function linkify(text) {
  const parts = String(text || '').split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className="underline break-all">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function ContextPreview({ contextMessage }) {
  const { t } = useTranslation();
  if (!contextMessage) return null;
  const label = contextMessage.text || contextMessage.caption || t(`messageTypes.${contextMessage.message_type}`);
  return (
    <div className="mb-1.5 rounded-lg border-s-[3px] border-brand bg-black/5 px-2.5 py-1.5 text-xs text-text-muted line-clamp-2 dark:bg-white/5">
      {label}
    </div>
  );
}

function MediaImage({ message, onOpenLightbox }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState('loading');
  const [retryKey, setRetryKey] = useState(0);
  const src = `${api.mediaUrl(message.id)}${retryKey ? `?retry=${retryKey}` : ''}`;

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={() => {
          setStatus('loading');
          setRetryKey((k) => k + 1);
        }}
        className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-6 text-xs text-danger"
      >
        <RefreshCw size={14} /> {t('message.mediaRetry')}
      </button>
    );
  }

  return (
    <div className="relative">
      {status === 'loading' && <div className="absolute inset-0 animate-pulse rounded-lg bg-black/10" />}
      <img
        src={src}
        alt=""
        loading="lazy"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        onClick={() => onOpenLightbox(src)}
        className="max-h-72 max-w-full cursor-pointer rounded-lg object-cover"
      />
    </div>
  );
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🙏'];

export default function MessageBubble({ message, contextMessage, reactionEmoji, onReply, onReact, onOpenLightbox }) {
  const { t, i18n } = useTranslation();
  const isOutbound = message.direction === 'outbound';
  const senderLabel =
    message.sender_type === 'agent'
      ? message.sent_by_name || t('message.sender.agent')
      : message.sender_type === 'bot'
        ? t('message.sender.bot')
        : null;
  const exactTimestamp = new Date(message.created_at).toLocaleString(i18n.language === 'ar' ? 'ar-AE' : 'en-US');
  const StatusIcon = isOutbound ? STATUS_ICON[message.status] : null;
  const mediaSrc = api.mediaUrl(message.id);

  if (message.message_type === 'system') {
    const data = message.system_data || {};
    const text =
      data.type === 'user_changed_number'
        ? t('system.userChangedNumber', { oldNumber: data.oldWaId, newNumber: data.newWaId })
        : message.text || t('messageTypes.system');
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-surface px-3.5 py-1 text-[11px] text-text-muted shadow-sm">{text}</span>
      </div>
    );
  }

  if (message.message_type === 'reaction') return null; // rendered as an overlay on its target instead

  function renderBody() {
    switch (message.message_type) {
      case 'image':
        return (
          <div className="flex flex-col gap-1">
            <MediaImage message={message} onOpenLightbox={onOpenLightbox} />
            {message.caption && <div className="px-0.5 text-sm">{linkify(message.caption)}</div>}
          </div>
        );

      case 'video':
        return (
          <div className="flex flex-col gap-1">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={mediaSrc} controls preload="metadata" className="max-h-72 max-w-full rounded-lg" />
            {message.caption && <div className="px-0.5 text-sm">{linkify(message.caption)}</div>}
          </div>
        );

      case 'audio':
      case 'voice':
        return <AudioPlayer src={mediaSrc} />;

      case 'sticker':
        return <img src={mediaSrc} alt="" loading="lazy" className="h-32 w-32 object-contain" />;

      case 'document':
        return (
          <a
            href={mediaSrc}
            download={message.filename || undefined}
            className="flex items-center gap-3 rounded-lg bg-black/5 px-3 py-2.5 hover:bg-black/10"
          >
            <FileText size={28} className="shrink-0 text-text-muted" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{message.filename || t('messageTypes.document')}</div>
              {message.file_size ? <div className="text-xs text-text-muted">{formatFileSize(message.file_size)}</div> : null}
            </div>
            <Download size={16} className="shrink-0 text-text-muted" />
          </a>
        );

      case 'location': {
        const mapsUrl = `https://www.google.com/maps?q=${message.latitude},${message.longitude}`;
        return (
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-start gap-2 rounded-lg bg-black/5 px-3 py-2.5 hover:bg-black/10">
            <MapPin size={20} className="mt-0.5 shrink-0 text-danger" />
            <div className="min-w-0">
              {message.location_name && <div className="text-sm font-semibold">{message.location_name}</div>}
              {message.location_address && <div className="text-xs text-text-muted">{message.location_address}</div>}
              <div className="text-xs text-brand underline">{t('message.openInMaps')}</div>
            </div>
          </a>
        );
      }

      case 'contacts': {
        const contacts = Array.isArray(message.contacts_data) ? message.contacts_data : [];
        return (
          <div className="flex flex-col gap-2">
            {contacts.map((c, i) => (
              <div key={i} className="rounded-lg bg-black/5 px-3 py-2.5">
                <div className="text-sm font-semibold">{c.name?.formatted_name}</div>
                {(c.phones || []).map((p, pi) => (
                  <div key={pi} dir="ltr" className="text-xs text-text-muted text-end">
                    {p.phone}
                  </div>
                ))}
                {(c.emails || []).map((e, ei) => (
                  <div key={ei} dir="ltr" className="text-xs text-text-muted text-end">
                    {e.email}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      }

      case 'interactive':
        return <div className="text-sm">✓ {message.text}</div>;

      case 'unsupported':
      case 'unknown':
        return (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <AlertTriangle size={16} />
            {t(`messageTypes.${message.message_type}`)}
          </div>
        );

      default:
        return <div className="whitespace-pre-wrap text-sm">{linkify(message.text)}</div>;
    }
  }

  return (
    <div className={`group flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div className="relative">
        <div className={`bubble bubble--${message.sender_type} bubble-row--${isOutbound ? 'out' : 'in'} px-3 py-2`}>
          {senderLabel && (
            <div className="mb-0.5 text-[11px] font-bold text-brand-strong">
              {senderLabel}
              {message.message_type === 'template' && ` ${t('message.templateBadge')}`}
            </div>
          )}
          <ContextPreview contextMessage={contextMessage} />
          {renderBody()}
          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-text-muted">
            <span title={exactTimestamp}>{formatClock(message.created_at, i18n.language)}</span>
            {StatusIcon && <StatusIcon size={13} className={message.status === 'failed' ? 'text-danger' : message.status === 'read' ? 'text-sky-500' : ''} />}
          </div>
        </div>

        {reactionEmoji && (
          <span className="absolute -bottom-2 rounded-full border border-border bg-surface px-1 text-xs shadow-sm start-2">
            {reactionEmoji}
          </span>
        )}

        {(onReply || onReact) && (
          <div className="absolute top-1 hidden -translate-y-1/2 items-center gap-0.5 rounded-full border border-border bg-surface p-0.5 shadow group-hover:flex end-[-28px]">
            {onReact && (
              <div className="group/react relative">
                <button type="button" className="rounded-full p-1 text-text-muted hover:bg-surface-2" aria-label="react">
                  😊
                </button>
                <div className="absolute -top-9 hidden gap-0.5 rounded-full border border-border bg-surface p-1 shadow-lg group-hover/react:flex start-1/2 -translate-x-1/2">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onReact(message.wa_message_id, emoji === reactionEmoji ? '' : emoji)}
                      className="rounded-full px-1 text-sm hover:bg-surface-2"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {onReply && (
              <button type="button" onClick={() => onReply(message)} className="rounded-full p-1 text-text-muted hover:bg-surface-2" aria-label="reply">
                <CornerUpLeft size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
