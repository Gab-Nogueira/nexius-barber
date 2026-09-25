'use client';

import { motion, useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';

export function RouteMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  return <motion.div key={pathname} className="route-motion" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : .32, ease: 'easeOut' }}>{children}</motion.div>;
}
