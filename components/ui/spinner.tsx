"use client";

import { Loader2Icon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/ui/utils";

const MotionLoader = motion.create(Loader2Icon);

function Spinner({ className, ...props }: ComponentProps<typeof MotionLoader>) {
  const reduceMotion = useReducedMotion();
  return (
    <MotionLoader
      role="status"
      aria-label="Loading"
      className={cn("size-4", className)}
      animate={{ rotate: reduceMotion ? 0 : 360 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 1, repeat: Infinity, ease: "linear" }
      }
      {...props}
    />
  );
}

export { Spinner };
