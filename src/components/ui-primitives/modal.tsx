import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

import { t } from '@/utils/i18n';

import { EhButton } from '../eh-button';

const modalRootMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { type: 'spring', visualDuration: 0.18, bounce: 0 },
} as const;

const modalPanelMotion = {
  initial: { opacity: 0, y: 12, scale: 0.985, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: 8, scale: 0.992, filter: 'blur(2px)' },
  transition: { type: 'spring', visualDuration: 0.28, bounce: 0.12 },
} as const;

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  panelClassName = '',
  bodyClassName = '',
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
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
        <motion.div className="eh-modal" role="presentation" {...modalRootMotion}>
          <button
            type="button"
            className="eh-modal__scrim"
            aria-label={t('close')}
            onClick={onClose}
          />
          <motion.section
            className={`eh-modal__panel eh-modal__panel--${size} ${panelClassName}`.trim()}
            role="dialog"
            aria-modal="true"
            {...modalPanelMotion}
          >
            {title ? (
              <header className="eh-modal__header">
                <div className="min-w-0 flex-1">{title}</div>
                <EhButton
                  isIconOnly
                  ehSize="sm"
                  className="eh-modal__close"
                  aria-label={t('close')}
                  onPress={onClose}
                >
                  <X size={16} strokeWidth={1.9} />
                </EhButton>
              </header>
            ) : null}
            <div className={`eh-modal__body scrollbar-glass ${bodyClassName}`.trim()}>
              {children}
            </div>
            {footer ? <footer className="eh-modal__footer">{footer}</footer> : null}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};
