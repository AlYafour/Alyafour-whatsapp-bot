import * as RadixDropdown from '@radix-ui/react-dropdown-menu';

export function DropdownMenu({ trigger, children, align = 'end' }) {
  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>{trigger}</RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align={align}
          sideOffset={8}
          className="anim-fade-up z-50 min-w-[180px] rounded-xl border border-border bg-surface p-1.5 shadow-xl"
        >
          {children}
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}

export function DropdownItem({ icon: Icon, children, ...props }) {
  return (
    <RadixDropdown.Item
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm cursor-pointer outline-none data-[highlighted]:bg-surface-2"
      {...props}
    >
      {Icon && <Icon size={16} className="text-text-muted" />}
      {children}
    </RadixDropdown.Item>
  );
}
