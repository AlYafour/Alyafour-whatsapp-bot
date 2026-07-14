import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

// Accessible modal built on Radix Dialog. On small screens it docks to the
// bottom of the viewport (bottom-sheet feel); on larger screens it's a
// centered card. `wide` widens the desktop card for content-heavy dialogs
// (e.g. the New Conversation template picker).
export default function Dialog({ open, onOpenChange, title, children, wide }) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-50 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <RadixDialog.Content
          className={`anim-fade-up fixed z-50 bg-surface text-text shadow-2xl focus:outline-none
            inset-x-0 bottom-0 rounded-t-3xl max-h-[85vh] overflow-y-auto p-5
            sm:inset-auto sm:top-1/2 sm:start-1/2 sm:-translate-x-1/2 rtl:sm:translate-x-1/2 sm:-translate-y-1/2
            sm:rounded-2xl sm:max-h-[90vh] sm:w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        >
          <div className="flex items-center justify-between mb-3">
            <RadixDialog.Title className="text-base font-bold">{title}</RadixDialog.Title>
            <RadixDialog.Close asChild>
              <button type="button" className="rounded-md p-1.5 hover:bg-surface-2 text-text-muted" aria-label="close">
                <X size={18} />
              </button>
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
