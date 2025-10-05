import React, { FC } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface IToastProps {
  visible: boolean;
  children: React.ReactNode;
}

export const Toast: FC<IToastProps> = ({ visible, children }) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 0, opacity: 0 }}
          animate={{
            y: 80,
            opacity: 1,
          }}
          exit={{
            y: 0,
            opacity: 0,
          }}
          className="bg-primary text-primary-foreground fixed top-0 flex justify-center rounded-xl p-2 px-4">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
