# Voice Dictation

Voice dictation input for the chat interface — users can speak prompts instead of typing. Uses the browser-native Web Speech API for zero-dependency, streaming speech-to-text. Dictated text inserts at the cursor position and coexists with typed text. Scoped to Phase 1: working microphone toggle with real-time streaming results.

## Decisions

- **Insertion point**: Dictated text inserts at the current cursor position in the textarea, not appended to the end. This enables natural editing workflows where users position the cursor, speak, then continue typing.
- **No auto-submit**: Dictation never auto-submits the prompt. The user must explicitly click Send or press Enter. The exception is the voice command "send" — if the final word of an utterance is "send", it triggers submission.
- **Phase 1 only**: No LLM-based transcript polishing. Accept browser-native accuracy for now. Transcript quality gaps (missing punctuation, occasional misrecognitions) are tolerable for short prompts.
- **Client-side only**: No server changes needed. The microphone button and speech recognition logic live entirely in the InputBar component.
- **Browser support**: Feature is only available where the Web Speech API exists (Chrome/Edge). The mic button is hidden entirely on unsupported browsers (Firefox/Safari).

## Use Cases

### UC-1: Start voice dictation (High)
- **Actor:** End User
- **Summary:** User activates the microphone to begin speaking a prompt instead of typing.
- **Given:**
  - The browser supports the Web Speech API
  - The chat input is not disabled (no prompt currently processing)
- **When:**
  - The user clicks the microphone button in the input bar
- **Then:**
  - The browser requests microphone permission (if not already granted)
  - SpeechRecognition begins listening
  - The mic button changes to a "listening" state with visual indicator
  - An aria-live region announces that dictation has started

### UC-2: Stream interim results into textarea (High, depends on UC-1)
- **Actor:** System
- **Summary:** As the user speaks, interim recognition results stream into the textarea at the cursor position in real-time.
- **Given:**
  - Dictation is active
- **When:**
  - The Speech API fires an onresult event with isFinal: false
- **Then:**
  - Interim text is inserted at the current cursor position in the textarea
  - Interim text is visually distinguished (e.g., dimmed or italicized) from committed text
  - The textarea auto-resizes to fit the content

### UC-3: Commit final recognition result (High, depends on UC-2)
- **Actor:** System
- **Summary:** When the Speech API finalizes a phrase, interim text is replaced with the committed result at the cursor position.
- **Given:**
  - Dictation is active
  - Interim text is displayed in the textarea
- **When:**
  - The Speech API fires an onresult event with isFinal: true
- **Then:**
  - The interim text is replaced with the finalized transcript
  - The finalized text is styled as normal input text
  - The cursor moves to the end of the newly inserted text

### UC-4: Stop voice dictation (High, depends on UC-1)
- **Actor:** End User
- **Summary:** User deactivates the microphone to stop listening and keep the captured text.
- **Given:**
  - Dictation is active
- **When:**
  - The user clicks the microphone button again (toggle off)
- **Then:**
  - SpeechRecognition stops listening
  - Any pending interim text is finalized and kept in the textarea
  - The mic button returns to its idle state
  - An aria-live region announces that dictation has stopped

### UC-5: Submit prompt via voice command (Medium, depends on UC-3)
- **Actor:** End User
- **Summary:** User says "send" as the final word of an utterance to submit the prompt without clicking the Send button.
- **Given:**
  - Dictation is active
  - The textarea contains text (dictated, typed, or both)
- **When:**
  - The Speech API produces a final result where the last word is "send"
- **Then:**
  - The word "send" is stripped from the textarea content
  - Dictation stops
  - The prompt is submitted as if the user clicked Send

### UC-6: Coexist with typed text (Medium, depends on UC-1)
- **Actor:** End User
- **Summary:** User can freely mix typing and dictation — dictated text inserts at the cursor position alongside typed text.
- **Given:**
  - The textarea contains typed text
  - The cursor is positioned within or at the end of the text
- **When:**
  - The user activates dictation and speaks
- **Then:**
  - Dictated text is inserted at the cursor position, not replacing existing text
  - The user can click to reposition the cursor and resume dictation at the new position
  - Typed and dictated text are indistinguishable once committed

### UC-7: Handle microphone permission denied (Medium, depends on UC-1)
- **Actor:** End User
- **Summary:** When the user denies microphone access, the UI communicates the problem clearly.
- **Given:**
  - The browser supports the Web Speech API
  - The user has not granted microphone permission
- **When:**
  - The user clicks the mic button and denies the browser permission prompt (or permission was previously denied)
- **Then:**
  - The mic button shows an error/disabled state
  - A tooltip or brief message explains that microphone access is required and how to re-enable it in browser settings
  - Dictation does not start

### UC-8: Hide mic button on unsupported browsers (High)
- **Actor:** System
- **Summary:** The microphone button is not shown when the browser lacks Web Speech API support.
- **Given:**
  - The browser does not support SpeechRecognition or webkitSpeechRecognition
- **When:**
  - The InputBar component renders
- **Then:**
  - No microphone button is displayed
  - The input bar functions exactly as it does today

### UC-9: Recover from mid-dictation error (Medium, depends on UC-1)
- **Actor:** System
- **Summary:** If the Speech API errors or disconnects mid-dictation, the UI recovers gracefully and preserves captured text.
- **Given:**
  - Dictation is active
- **When:**
  - The Speech API fires an onerror or onend event unexpectedly (network loss, session timeout, no audio input)
- **Then:**
  - Dictation stops
  - All previously committed text remains in the textarea
  - Any pending interim text is kept as-is
  - The mic button returns to idle state
  - A brief, non-blocking notification indicates dictation was interrupted

### UC-10: Auto-restart on silence timeout (Medium, depends on UC-1)
- **Actor:** System
- **Summary:** When the Speech API auto-stops after ~60s of silence, dictation restarts automatically if the user hasn't toggled it off.
- **Given:**
  - Dictation is active
  - The user has not clicked the mic button to stop
- **When:**
  - The Speech API fires onend due to silence timeout (not an error)
- **Then:**
  - SpeechRecognition is restarted automatically
  - The listening indicator remains active
  - No text is lost

## Event Model

This feature is **client-side only** — no new server commands, domain events, or projections are needed. All speech recognition logic lives in the browser via the Web Speech API. The only server interaction is the existing `submit_prompt` command, used unchanged when the user submits dictated text.

The event model below documents how voice dictation integrates with the existing infrastructure and where new client-side state lives.

```conclave:eventmodel
{"slice":"voice-dictation","label":"Voice Dictation (UC-1, UC-2, UC-3, UC-4, UC-6, UC-7, UC-8, UC-9, UC-10)","screen":"InputBar","command":{"name":"submit_prompt","new":false,"fields":{"text":"string","images?":"ImageAttachment[]"}},"events":[{"name":"PromptSubmitted","new":false,"fields":{"text":"string","images?":"ImageAttachment[]"}}],"projections":[{"name":"messages (client slice)","new":false,"fields":{"messages":"Message[]","isProcessing":"boolean"}}],"sideEffects":["SpeechRecognition start/stop managed entirely in client React state","Interim text rendered inline in textarea via local component state","Browser microphone permission prompt (navigator.mediaDevices)","aria-live region announces dictation start/stop","Auto-restart SpeechRecognition on silence timeout (onend without error)","Permission denied: show error/disabled state on mic button, display tooltip explaining how to re-enable microphone in browser settings (UC-7)"]}
```

```conclave:eventmodel
{"slice":"voice-submit","label":"Voice Submit Command (UC-5)","screen":"InputBar","command":{"name":"submit_prompt","new":false,"fields":{"text":"string"},"feeds":["messages (client slice)"]},"events":[{"name":"PromptSubmitted","new":false,"fields":{"text":"string"}}],"projections":[{"name":"messages (client slice)","new":false,"fields":{"messages":"Message[]","isProcessing":"boolean"}}],"sideEffects":["Strip trailing 'send' keyword from transcript before submission","Stop SpeechRecognition","Trigger existing onSubmit callback with cleaned text"]}
```

### Architecture Notes

- **No new types in `server/types.ts`** — `submit_prompt` command and `PromptSubmitted` event are reused as-is.
- **No new server slices or projections** — the write side and read side are untouched.
- **New client-side state** is local to the `InputBar` component (React `useState`/`useRef`), not in the global `AppState` reducer. Dictation state (`isListening`, `interimText`, `error`) is transient UI state, not domain state.
- **New component logic** in `InputBar`: a `useSpeechRecognition` hook (or inline logic) that manages `SpeechRecognition` lifecycle, cursor-position insertion, interim/final result handling, and auto-restart.
- **Feature detection** gates the mic button: `typeof window.SpeechRecognition !== 'undefined' || typeof window.webkitSpeechRecognition !== 'undefined'`.
- **CSS additions** in `style.css`: mic button states (idle, listening, error), interim text styling, pulse/glow animation for listening indicator.
