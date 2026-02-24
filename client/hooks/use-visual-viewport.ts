import { useState } from 'react';

export function useVisualViewport() {
  return { viewportHeight: window.innerHeight, keyboardOpen: false };
}
