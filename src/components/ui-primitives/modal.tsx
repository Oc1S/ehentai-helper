import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cva } from 'class-variance-authority';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

import { t } from '@/utils/i18n';

import { EhButton } from '../eh-button';

const modalRootMotion = {
  initial: { opacity: 0, pointerEvents: 'auto' },
  animate: { opacity: 1, pointerEvents: 'auto' },
  exit: { opacity: 0, pointerEvents: 'none' },
  transition: { type: 'spring', visualDuration: 0.18, bounce: 0.1 },
} as const;

const modalOverlayPanelMotion = {
  initial: { opacity: 0, y: 14, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: 10, filter: 'blur(2px)' },
  transition: { type: 'spring', visualDuration: 0.28, bounce: 0.2 },
} as const;

const modalDialogPanelMotion = {
  initial: { opacity: 0, y: 8, scale: 0.985, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: 6, scale: 0.992, filter: 'blur(2px)' },
  transition: { type: 'spring', visualDuration: 0.22, bounce: 0.08 },
} as const;

type ModalPresentation = 'dialog' | 'overlay';

const modalRootClass = cva(
  'eh-modal fixed inset-0 z-50 flex h-full w-full [isolation:isolate]',
  {
    variants: {
      presentation: {
        overlay: 'eh-modal--overlay flex-col overflow-hidden p-0',
        dialog: 'eh-modal--dialog items-center justify-center p-5',
      },
    },
    defaultVariants: {
      presentation: 'overlay',
    },
  }
);

const modalPanelClass = cva('eh-modal__panel relative z-10 flex w-full flex-col overflow-hidden', {
  variants: {
    presentation: {
      overlay:
        'eh-modal__panel--overlay h-full max-h-none max-w-none border-0 bg-transparent shadow-none',
      dialog:
        'eh-modal__panel--dialog max-h-[calc(100vh-40px)] rounded-eh-md border border-[var(--eh-hairline)] bg-canvas shadow-card-elevated',
    },
    size: {
      sm: '',
      md: '',
      lg: '',
      xl: '',
    },
  },
  compoundVariants: [
    { presentation: 'dialog', size: 'sm', className: 'max-w-[380px]' },
    { presentation: 'dialog', size: 'md', className: 'max-w-[560px]' },
    { presentation: 'dialog', size: 'lg', className: 'max-w-[760px]' },
    { presentation: 'dialog', size: 'xl', className: 'max-w-[920px]' },
  ],
  defaultVariants: {
    presentation: 'overlay',
    size: 'md',
  },
});

const modalHeaderClass = cva(
  'eh-modal__header relative z-10 flex shrink-0 gap-4 border-b border-[var(--eh-hairline)] bg-transparent px-5 pr-14',
  {
    variants: {
      presentation: {
        overlay: 'h-popup-header items-center',
        dialog: 'items-start py-4',
      },
    },
    defaultVariants: {
      presentation: 'overlay',
    },
  }
);

const modalBodyClass = cva(
  'eh-modal__body scrollbar-glass relative z-10 min-h-0 flex-1 overflow-hidden bg-transparent',
  {
    variants: {
      presentation: {
        overlay: 'px-5 py-4',
        dialog: 'p-5',
      },
    },
    defaultVariants: {
      presentation: 'overlay',
    },
  }
);

const modalFooterClass = cva(
  'eh-modal__footer relative z-10 flex shrink-0 items-center justify-end gap-2 border-t border-[var(--eh-hairline)] bg-transparent px-5',
  {
    variants: {
      presentation: {
        overlay: 'h-popup-footer py-2.5',
        dialog: 'py-3',
      },
    },
    defaultVariants: {
      presentation: 'overlay',
    },
  }
);

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  presentation = 'overlay',
  panelClassName = '',
  bodyClassName = '',
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  presentation?: ModalPresentation;
  panelClassName?: string;
  bodyClassName?: string;
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className={modalRootClass({ presentation })}
          role="presentation"
          {...modalRootMotion}
        >
          <button
            type="button"
            className="eh-modal__scrim absolute inset-0 h-full w-full"
            aria-label={t('close')}
            onClick={onClose}
          />
          <motion.section
            className={modalPanelClass({ presentation, size, className: panelClassName })}
            role="dialog"
            aria-modal="true"
            {...(presentation === 'dialog' ? modalDialogPanelMotion : modalOverlayPanelMotion)}
          >
            {title ? (
              <header className={modalHeaderClass({ presentation })}>
                <div className="min-w-0 flex-1">{title}</div>
                <EhButton
                  isIconOnly
                  ehSize="sm"
                  className="absolute right-3 top-3 z-10"
                  aria-label={t('close')}
                  onPress={onClose}
                >
                  <X size={16} strokeWidth={1.9} />
                </EhButton>
              </header>
            ) : null}
            <div className={modalBodyClass({ presentation, className: bodyClassName })}>
              {children}
            </div>
            {footer ? (
              <footer className={modalFooterClass({ presentation })}>{footer}</footer>
            ) : null}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};
