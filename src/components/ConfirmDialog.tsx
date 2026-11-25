import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

/**
 * A small confirmation in the app style, in place of the browser `confirm()` box.
 * It opens above the current modal. Escape, "Cancel" or the scrim closes it.
 * The focus starts on "Cancel", so Enter alone never deletes.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const box = useRef<HTMLElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;

  useEffect(() => {
    // Capture phase: Escape closes this box only, not the modal under it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      cancel.current();
    };
    window.addEventListener('keydown', onKey, true);
    const previous = document.activeElement as HTMLElement | null;
    cancelButton.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, []);

  // Keep the focus inside the box.
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab' || !box.current) return;
    const buttons = [...box.current.querySelectorAll<HTMLButtonElement>('button')];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="modal-layer confirm-layer">
      <div className="modal-scrim" onClick={onCancel} />
      <section
        ref={box}
        className="modal confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={message ? `${id}-text` : undefined}
        onKeyDown={onKeyDown}
      >
        <h2 id={`${id}-title`} className="confirm__title">
          {title}
        </h2>
        {message && (
          <p id={`${id}-text`} className="confirm__text">
            {message}
          </p>
        )}
        <div className="confirm__actions">
          <button ref={cancelButton} type="button" className="tm-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="tm-btn tm-btn--primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
