"use client";

import { MotionConfig, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function MotionProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
    >
      {children}
    </MotionConfig>
  );
}
