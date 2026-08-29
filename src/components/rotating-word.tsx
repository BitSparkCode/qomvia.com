"use client";

import { useEffect, useState } from "react";

/**
 * Cycles the assistant name in the headline. Server-renders the first word, so
 * the sentence is complete without JavaScript and does not reflow on hydration.
 */
export function RotatingWord({ words, intervalMs = 2200 }: { words: string[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % words.length), intervalMs);
    return () => window.clearInterval(timer);
  }, [words.length, intervalMs]);

  return (
    <span className="inline-grid align-bottom">
      {words.map((word, position) => (
        <span
          key={word}
          aria-hidden={position === index ? undefined : true}
          className="col-start-1 row-start-1 whitespace-nowrap text-accent transition-[opacity,transform] duration-500"
          style={{
            opacity: position === index ? 1 : 0,
            transform: position === index ? "translateY(0)" : "translateY(0.14em)",
          }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
