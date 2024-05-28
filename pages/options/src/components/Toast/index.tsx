import React, { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
          className="fixed top-0 p-2 bg-primary rounded-lg text-slate-100">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
