import { useState, useEffect, useRef } from 'react';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

interface CallTimerProps {
  startTime: number;
}

export function CallTimer({ startTime }: CallTimerProps) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startTime) / 1000));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startTime]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <span className="text-sm text-white/70 font-mono">
      {pad(mins)}:{pad(secs)}
    </span>
  );
}
