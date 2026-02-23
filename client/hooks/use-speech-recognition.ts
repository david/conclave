import { useState, useRef, useCallback } from "react";

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
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const start = useCallback(() => {
    if (!recognitionRef.current) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onend = () => {
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    }
    recognitionRef.current.start();
    setIsListening(true);
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  return {
    isSupported,
    isListening,
    error: null,
    interimText: "",
    start,
    stop,
  };
}
