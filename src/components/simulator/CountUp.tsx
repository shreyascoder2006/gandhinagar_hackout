import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

interface Props {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

/** Animates between successive values (the "numbers counting down" moment in the demo). */
export default function CountUp({ value, format = (n) => Math.round(n).toLocaleString("en-IN"), duration = 0.8, className }: Props) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}
