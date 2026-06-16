import { useCallback, useRef } from 'react';

/** Minimum pointer movement (px) before a drag is recognised.
 *  Prevents a simple click on the resize handle from snapping the width
 *  to a fixed pixel value (replacing a responsive CSS-variable width). */
const DRAG_THRESHOLD = 3;

interface UseResizableOptions {
  /** 1 = sidebar (drag right to widen), -1 = drawer (drag left to widen) */
  direction: 1 | -1;
  min: number;
  max: number | (() => number);
  currentWidth: number;
  /** Optional: ref to the resizable container element. When provided, the actual
   *  offsetWidth is used as start width instead of currentWidth (fixes the case
   *  where currentWidth is 0 / CSS-variable-driven). */
  containerRef?: React.RefObject<HTMLElement | null>;
  onWidthChange: (w: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function useResizable(opts: UseResizableOptions) {
  const dragRef = useRef<{ startX: number; startWidth: number; activated: boolean } | null>(null);

  const resolveMax = () =>
    typeof opts.max === 'function' ? opts.max() : opts.max;

  const clamp = (v: number) =>
    Math.max(opts.min, Math.min(resolveMax(), v));

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      // Prefer actual DOM width over state value (handles CSS-variable-driven default)
      const actualWidth = opts.containerRef?.current?.offsetWidth || opts.currentWidth;
      dragRef.current = { startX: clientX, startWidth: actualWidth, activated: false };

      const onMove = (ev: MouseEvent | TouchEvent) => {
        if (!dragRef.current) return;
        const cx = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
        const absDelta = Math.abs(cx - dragRef.current.startX);

        // Don't start resizing until the pointer has moved beyond the threshold.
        // This prevents a simple click from converting responsive CSS widths to
        // fixed pixels and avoids capturing mid-animation offsetWidth values.
        if (!dragRef.current.activated) {
          if (absDelta < DRAG_THRESHOLD) return;
          // Re-read DOM width NOW (post-animation) for an accurate baseline
          const freshWidth = opts.containerRef?.current?.offsetWidth || dragRef.current.startWidth;
          dragRef.current.startWidth = freshWidth;
          dragRef.current.startX = cx;
          dragRef.current.activated = true;
          opts.onDragStart?.();
        }

        const delta = (cx - dragRef.current.startX) * opts.direction;
        opts.onWidthChange(clamp(dragRef.current.startWidth + delta));
      };

      const onUp = () => {
        const wasDragging = dragRef.current?.activated ?? false;
        dragRef.current = null;
        if (wasDragging) {
          opts.onDragEnd?.();
        }
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opts.currentWidth, opts.direction, opts.min, opts.onWidthChange, opts.onDragStart, opts.onDragEnd],
  );

  return { handlePointerDown };
}
