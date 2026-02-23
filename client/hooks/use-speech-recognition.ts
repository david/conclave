import { useState } from "react";

type SpeechState = {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  interimText: string;
};

type UseSpeechRecognitionReturn = SpeechState & {
  start: () => void;
  stop: () => void;
};

function detectSupport(): boolean {
  return (
    typeof window !== "undefined" &&
    (typeof (window as any).SpeechRecognition !== "undefined" ||
      typeof (window as any).webkitSpeechRecognition !== "undefined")
  );
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isSupported] = useState(() => detectSupport());

  return {
    isSupported,
    isListening: false,
    error: null,
    interimText: "",
    start: () => {},
    stop: () => {},
  };
}
