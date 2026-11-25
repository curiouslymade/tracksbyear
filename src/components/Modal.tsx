import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './Icons';

/** A centred modal dialog. Escape, the close button or the scrim closes it. */
export function Modal({
  title,
  kicker,
  actions,
  titleAside,
  wide = false,
  onClose,
  children,
}: {
  title: string;
  kicker?: string;
  /** Extra icon buttons, shown before the close button. */
  actions?: ReactNode;
  /** Something small beside the title, such as a play button. */
  titleAside?: ReactNode;
  /** A larger modal, for the breakdown: it shows everything without a scroll on a laptop screen. */
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  // Runs once per opening, so a re-render does not move the focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="modal-layer">
      <div className="modal-scrim" onClick={onClose} />
      <section
        ref={panel}
        className={wide ? 'modal modal--wide' : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <header className="modal__head">
          {/* The bin and close buttons sit in the top right corner. The heading starts below them. */}
          <div className="modal__actions">
            {actions}
            <button className="modal__close" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {kicker && <p className="tm-kicker">{kicker}</p>}
          <div className="modal__title-row">
            <h2 id="modal-title" className="modal__title">
              {title}
            </h2>
            {titleAside}
          </div>
        </header>
        <div className="modal__body">{children}</div>
      </section>
    </div>
  );
}
