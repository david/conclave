import { useState, useEffect } from 'react';

export function useVisualViewport() {
  const [viewportHeight, setViewportHeight] = useState(() =>
    window.visualViewport?.height ?? window.innerHeight
  );

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function onResize() {
      setViewportHeight(vv!.height);
    }

    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const keyboardOpen = viewportHeight < window.innerHeight * 0.75;

  return { viewportHeight, keyboardOpen };
}
