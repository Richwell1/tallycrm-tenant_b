import { useEffect, useRef, type KeyboardEvent } from "react";

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalA11y(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  options: { disabled?: boolean } = {},
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const element = ref.current;
    const focusable = element?.querySelector<HTMLElement>(focusableSelector);
    focusable?.focus();
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !options.disabled) {
      event.preventDefault();
      onOpenChange(false);
      return;
    }

    if (event.key !== "Tab") return;
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return { ref, onKeyDown };
}
