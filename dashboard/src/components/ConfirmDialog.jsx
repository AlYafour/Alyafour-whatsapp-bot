import Dialog from './ui/Dialog';
import Button from './ui/Button';

export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, danger }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()} title={title}>
      <p className="text-sm text-text-muted mb-4">{message}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
