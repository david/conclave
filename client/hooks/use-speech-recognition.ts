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

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  return {
    isSupported: false,
    isListening: false,
    error: null,
    interimText: "",
    start: () => {},
    stop: () => {},
  };
}
