"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/** Counts smoothly from the previous value to the new one. */
export function CountUp({
  value,
  decimals = 2,
  className,
  from,
}: {
  value: number;
  decimals?: number;
  className?: string;
  from?: number;
}) {
  const reduce = useReducedMotion();
  const prev = useRef(from ?? value);
  const [shown, setShown] = useState(from ?? value);
  useEffect(() => {
    if (reduce) {
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration: 1.1,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setShown(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return (
    <span className={className}>
      {(reduce ? value : shown).toFixed(decimals)}
    </span>
  );
}
