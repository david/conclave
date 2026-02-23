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

type UseSpeechRecognitionOptions = {
  onFinalResult?: (text: string) => void;
  onVoiceSubmit?: (text: string) => void;
};

export function useSpeechRecognition(options?: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [isSupported] = useState(() => detectSupport());
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);

  const onFinalResultRef = useRef(options?.onFinalResult);
  onFinalResultRef.current = options?.onFinalResult;

  const onVoiceSubmitRef = useRef(options?.onVoiceSubmit);
  onVoiceSubmitRef.current = options?.onVoiceSubmit;

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
      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            onFinalResultRef.current?.(transcript);
            setInterimText("");
          } else {
            setInterimText(transcript);
          }
        }
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
    interimText,
    start,
    stop,
  };
}
