import { useState, useRef, useCallback, useEffect } from "react";

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

const SEND_SUFFIX = /\bsend\s*$/i;

export function useSpeechRecognition(options?: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [isSupported] = useState(() => detectSupport());
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const onFinalResultRef = useRef(options?.onFinalResult);
  onFinalResultRef.current = options?.onFinalResult;

  const onVoiceSubmitRef = useRef(options?.onVoiceSubmit);
  onVoiceSubmitRef.current = options?.onVoiceSubmit;

  const stoppedManuallyRef = useRef(false);
  const hadErrorRef = useRef(false);
  // Tracks the number of render cycles since start() was called.
  // Used to guard against rapid restart loops: if onend fires before
  // a render has occurred since start(), it's likely a broken session.
  const startRenderCountRef = useRef(0);
  const rendersSinceStartRef = useRef(0);

  // Increment render counter on every render while listening
  useEffect(() => {
    if (isListening) {
      rendersSinceStartRef.current++;
    }
  });

  const start = useCallback(() => {
    setError(null);
    hadErrorRef.current = false;
    stoppedManuallyRef.current = false;
    rendersSinceStartRef.current = 0;

    if (!recognitionRef.current) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onend = () => {
        if (stoppedManuallyRef.current) {
          stoppedManuallyRef.current = false;
          setIsListening(false);
          return;
        }
        if (hadErrorRef.current) {
          setIsListening(false);
          return;
        }
        // Guard against rapid restart loops: if no render has occurred
        // since start(), the session ended immediately — don't restart.
        if (rendersSinceStartRef.current === 0) {
          setIsListening(false);
          return;
        }
        // Auto-restart: recognition ended normally (e.g. silence timeout)
        rendersSinceStartRef.current = 0;
        recognitionRef.current.start();
      };

      recognition.onerror = (event: any) => {
        const errorCode = event.error;
        if (errorCode === "not-allowed") {
          setError("permission-denied");
        } else {
          setError(errorCode);
        }
        setIsListening(false);
        hadErrorRef.current = true;
      };

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            if (SEND_SUFFIX.test(transcript)) {
              const cleaned = transcript.replace(SEND_SUFFIX, "").trim();
              onVoiceSubmitRef.current?.(cleaned);
              setInterimText("");
              stoppedManuallyRef.current = true;
              recognitionRef.current.stop();
              setIsListening(false);
            } else {
              onFinalResultRef.current?.(transcript);
              setInterimText("");
            }
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
    stoppedManuallyRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  return {
    isSupported,
    isListening,
    error,
    interimText,
    start,
    stop,
  };
}
