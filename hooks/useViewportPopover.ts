import { useLayoutEffect, useRef, useState } from 'react';

/** Keep a floating editor/menu reachable when opened near a viewport edge. */
export function useViewportPopover(position: { x: number; y: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useState(position);
  useLayoutEffect(() => {
    const place = () => {
      const box = ref.current?.getBoundingClientRect();
      if (!box) return;
      const x = Math.max(12, Math.min(position.x, window.innerWidth - box.width - 12));
      const y = Math.max(12, Math.min(position.y, window.innerHeight - box.height - 12));
      setLocation(previous => previous.x === x && previous.y === y ? previous : { x, y });
    };
    place();
    const observer = new ResizeObserver(place);
    if (ref.current) observer.observe(ref.current);
    window.addEventListener('resize', place);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); };
  }, [position.x, position.y]);
  return { ref, left: location.x, top: location.y };
}
