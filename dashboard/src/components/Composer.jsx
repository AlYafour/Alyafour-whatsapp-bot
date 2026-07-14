import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Send, Paperclip, Image as ImageIcon, Video, FileText, Music, Mic, MapPin, User as UserIcon, X, Smile,
} from 'lucide-react';
import { DropdownMenu, DropdownItem } from './ui/DropdownMenu';
import Button from './ui/Button';
import VoiceRecorder from './VoiceRecorder';
import LocationPicker from './LocationPicker';
import ContactPicker from './ContactPicker';
import { formatFileSize } from '../utils/format';

const ACCEPT = {
  image: 'image/jpeg,image/png',
  video: 'video/mp4,video/3gpp',
  document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt',
  audio: 'audio/*',
  sticker: 'image/webp',
};

function newIdempotencyKey() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Composer({ disabled, disabledReason, replyTo, onCancelReply, onSendText, onSendAttachment, onSendVoice, onSendLocation, onSendContact }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const [pendingFile, setPendingFile] = useState(null); // { file, type, previewUrl, caption }
  const [uploadProgress, setUploadProgress] = useState(null);
  const uploadHandleRef = useRef(null);

  const [showRecorder, setShowRecorder] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showContact, setShowContact] = useState(false);

  const fileInputRef = useRef(null);
  const pendingTypeRef = useRef('image');

  function pickFile(type) {
    pendingTypeRef.current = type;
    fileInputRef.current.setAttribute('accept', ACCEPT[type]);
    fileInputRef.current.click();
  }

  function handleFileChosen(file, type) {
    setError('');
    setPendingFile({ file, type, previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null, caption: '' });
  }

  function onFileInputChange(e) {
    const file = e.target.files?.[0];
    if (file) handleFileChosen(file, pendingTypeRef.current);
    e.target.value = '';
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document';
    handleFileChosen(file, type);
  }

  function onPaste(e) {
    const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
    if (item) {
      const file = item.getAsFile();
      if (file) handleFileChosen(file, 'image');
    }
  }

  async function submitText(e) {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      await onSendText(text.trim(), replyTo?.wa_message_id);
      setText('');
      onCancelReply?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function sendPendingFile() {
    if (!pendingFile) return;
    setError('');
    setUploadProgress(0);
    const idempotencyKey = newIdempotencyKey();
    try {
      const handle = onSendAttachment(
        {
          file: pendingFile.file,
          type: pendingFile.type,
          caption: pendingFile.caption || undefined,
          filename: pendingFile.file.name,
          contextMessageWaId: replyTo?.wa_message_id,
          idempotencyKey,
          onProgress: setUploadProgress,
        }
      );
      uploadHandleRef.current = handle;
      await handle.promise;
      setPendingFile(null);
      setUploadProgress(null);
      onCancelReply?.();
    } catch (err) {
      if (!err.cancelled) setError(err.message);
      setUploadProgress(null);
    }
  }

  function cancelUpload() {
    uploadHandleRef.current?.cancel();
  }

  async function handleVoiceSend(blob, mimeType) {
    setShowRecorder(false);
    setError('');
    try {
      await onSendVoice(blob, mimeType, replyTo?.wa_message_id);
      onCancelReply?.();
    } catch (err) {
      setError(err.message);
    }
  }

  if (disabled) {
    return (
      <div className="border-t border-border bg-surface px-4 py-3">
        <div className="flex items-center justify-center gap-2 rounded-xl bg-pending-soft px-3 py-2.5 text-center text-xs font-semibold text-pending">
          {disabledReason}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border-t border-border bg-surface px-3 py-2.5 sm:px-4 sm:py-3 ${dragOver ? 'ring-2 ring-brand ring-inset' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <input ref={fileInputRef} type="file" hidden onChange={onFileInputChange} />

      {dragOver && (
        <div className="mb-2 rounded-lg border-2 border-dashed border-brand py-3 text-center text-sm text-brand">
          {t('composer.dropHere')}
        </div>
      )}

      {replyTo && !pendingFile && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5 text-xs">
          <span className="truncate">
            <b>{t('composer.replyingTo')}:</b> {replyTo.text || replyTo.caption || t(`messageTypes.${replyTo.message_type}`)}
          </span>
          <button type="button" onClick={onCancelReply} aria-label={t('composer.cancelReply')}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Attachment preview replaces the text row entirely — one clear send action. */}
      {pendingFile && (
        <div className="rounded-2xl border border-border bg-surface-2/60 p-3">
          <div className="flex items-center gap-3">
            {pendingFile.previewUrl ? (
              <img src={pendingFile.previewUrl} alt="" className="h-16 w-16 rounded-lg object-cover ring-1 ring-border" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-surface ring-1 ring-border">
                <FileText size={26} className="text-text-muted" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{pendingFile.file.name}</div>
              <div className="text-xs text-text-muted">{formatFileSize(pendingFile.file.size)}</div>
              {uploadProgress !== null && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
            </div>
            {uploadProgress === null && (
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                aria-label={t('composer.cancelReply')}
                className="rounded-full p-2 text-text-muted hover:bg-surface-2 hover:text-danger"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {uploadProgress === null ? (
            <div className="mt-2.5 flex items-end gap-2">
              <input
                value={pendingFile.caption}
                onChange={(e) => setPendingFile({ ...pendingFile, caption: e.target.value })}
                placeholder={t('composer.captionPlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendPendingFile();
                }}
                className="flex-1 rounded-3xl border border-border bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-text-muted/70"
              />
              <button
                type="button"
                onClick={sendPendingFile}
                aria-label={t('composer.send')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-brand to-brand-strong text-white shadow-md transition-all duration-150 hover:brightness-110 active:scale-95"
              >
                <Send size={17} className="rtl:-scale-x-100" />
              </button>
            </div>
          ) : (
            <div className="mt-2.5 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={cancelUpload}>
                {t('composer.cancelUpload')}
              </Button>
            </div>
          )}
        </div>
      )}

      {showRecorder && !pendingFile && <div className="mb-2"><VoiceRecorder onSend={handleVoiceSend} onClose={() => setShowRecorder(false)} /></div>}

      {!pendingFile && (
      <form onSubmit={submitText} className="flex items-end gap-2">
        <DropdownMenu
          trigger={
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-brand"
              aria-label={t('composer.attach')}
            >
              <Paperclip size={19} />
            </button>
          }
          align="start"
        >
          <DropdownItem icon={ImageIcon} onSelect={() => pickFile('image')}>{t('composer.attachImage')}</DropdownItem>
          <DropdownItem icon={Video} onSelect={() => pickFile('video')}>{t('composer.attachVideo')}</DropdownItem>
          <DropdownItem icon={FileText} onSelect={() => pickFile('document')}>{t('composer.attachDocument')}</DropdownItem>
          <DropdownItem icon={Music} onSelect={() => pickFile('audio')}>{t('composer.attachAudio')}</DropdownItem>
          <DropdownItem icon={Smile} onSelect={() => pickFile('sticker')}>{t('composer.attachSticker')}</DropdownItem>
          <DropdownItem icon={Mic} onSelect={() => setShowRecorder(true)}>{t('composer.attachVoice')}</DropdownItem>
          <DropdownItem icon={MapPin} onSelect={() => setShowLocation(true)}>{t('composer.attachLocation')}</DropdownItem>
          <DropdownItem icon={UserIcon} onSelect={() => setShowContact(true)}>{t('composer.attachContact')}</DropdownItem>
        </DropdownMenu>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          placeholder={t('composer.placeholder')}
          rows={1}
          className="max-h-32 flex-1 resize-none rounded-3xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm outline-none placeholder:text-text-muted/70"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submitText(e);
          }}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label={t('composer.send')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-brand to-brand-strong text-white shadow-md transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:shadow-none disabled:active:scale-100"
        >
          {sending ? <span className="spinner" /> : <Send size={17} className="rtl:-scale-x-100" />}
        </button>
      </form>
      )}

      {error && <div className="mt-1.5 text-xs text-danger">{error}</div>}

      <LocationPicker open={showLocation} onClose={() => setShowLocation(false)} onSend={async (payload) => { await onSendLocation(payload); setShowLocation(false); }} />
      <ContactPicker open={showContact} onClose={() => setShowContact(false)} onSend={async (contacts) => { await onSendContact(contacts); setShowContact(false); }} />
    </div>
  );
}
