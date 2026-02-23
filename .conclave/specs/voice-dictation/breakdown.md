# Voice Dictation — Implementation

Client-side voice dictation for the chat input bar using the browser-native Web Speech API. All changes are confined to the client — no server modifications needed. A `useSpeechRecognition` hook encapsulates the Web Speech API lifecycle, and the `InputBar` component gains a mic toggle button with visual states (idle, listening, error). Interim results stream into the textarea at the cursor position; final results commit in place. A "send" voice command triggers submission. The mic button is hidden entirely on unsupported browsers.

## New Types

No new types in `server/types.ts` or `client/types.ts`. All state is local to the `InputBar` component via React `useState`/`useRef`. The hook's return type is defined inline in the hook file:

```ts
// client/hooks/use-speech-recognition.ts
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
```

## UC-8: Hide mic button on unsupported browsers

This use case has no dependencies and gates all other functionality, so it comes first.

**Files:**
- `client/hooks/use-speech-recognition.ts` — new file, custom hook
- `client/components/input-bar.tsx` — consume `isSupported` to conditionally render mic button

**Steps:**
1. Create `client/hooks/use-speech-recognition.ts` with a `useSpeechRecognition` hook. On mount, check `typeof window.SpeechRecognition !== 'undefined' || typeof window.webkitSpeechRecognition !== 'undefined'` and set `isSupported`.
2. Return `{ isSupported, isListening: false, error: null, interimText: '', start: noop, stop: noop }` as the initial shape. The `start`/`stop`/event handlers will be filled in by subsequent use cases.
3. In `InputBar`, call `useSpeechRecognition()`. Conditionally render the mic button only when `isSupported` is true. Place it in `.input-bar__row` between the textarea and the send/cancel button.

**Tests:**
- `client/hooks/use-speech-recognition.test.ts` — When `window.SpeechRecognition` and `window.webkitSpeechRecognition` are both undefined, `isSupported` is `false`. When either is defined, `isSupported` is `true`.

## UC-1 + UC-4: Start and stop voice dictation

These are the toggle pair — clicking the mic button starts listening (UC-1), clicking again stops it (UC-4). Implemented together since they share the same SpeechRecognition instance lifecycle.

**Files:**
- `client/hooks/use-speech-recognition.ts` — implement `start()` and `stop()`, manage `isListening` state
- `client/components/input-bar.tsx` — wire mic button click to `start`/`stop` toggle
- `client/style.css` — mic button idle and listening states, pulse animation

**Steps:**
1. In `useSpeechRecognition`, create a `SpeechRecognition` instance via `useRef` (lazily initialized on first `start()` call). Configure: `continuous = true`, `interimResults = true`, `lang = 'en-US'`.
2. `start()`: call `recognition.start()`, set `isListening = true`, clear any prior `error`. If the browser requests microphone permission, this triggers it.
3. `stop()`: call `recognition.stop()`, set `isListening = false`.
4. Attach `onend` handler: set `isListening = false` (covers unexpected stops).
5. In `InputBar`, add a `<button>` with class `input-bar__btn input-bar__btn--mic`. On click, toggle: if `isListening` call `stop()`, else call `start()`. Hide the button when `isProcessing` is true (textarea is disabled during processing, dictation shouldn't start).
6. Add an `aria-live="polite"` region (visually hidden) that announces "Dictation started" / "Dictation stopped" when `isListening` changes.
7. In `style.css`, add `.input-bar__btn--mic` styles: icon-sized button matching existing button dimensions. Add `.input-bar__btn--mic--listening` with an amber pulse/glow animation to indicate active listening.

**Tests:**
- `client/hooks/use-speech-recognition.test.ts` — Calling `start()` sets `isListening` to `true` and calls `recognition.start()`. Calling `stop()` sets `isListening` to `false` and calls `recognition.stop()`.

## UC-2 + UC-3 + UC-6: Stream interim results, commit finals, coexist with typed text

These three use cases form the core text insertion pipeline. Interim results appear at the cursor position (UC-2), are replaced by final results (UC-3), and coexist with typed text at arbitrary cursor positions (UC-6).

**Files:**
- `client/hooks/use-speech-recognition.ts` — handle `onresult` events, track interim text
- `client/components/input-bar.tsx` — merge dictated text into the textarea at cursor position
- `client/style.css` — interim text visual distinction (optional, see note below)

**Steps:**
1. In `useSpeechRecognition`, attach an `onresult` handler. Iterate `event.results` from `event.resultIndex` onward. For each result:
   - If `result.isFinal === false`: update `interimText` state with the transcript.
   - If `result.isFinal === true`: call an `onFinalResult(transcript)` callback (passed into the hook), then clear `interimText`.
2. The hook accepts a callback `onFinalResult: (text: string) => void` as a parameter. This keeps the hook decoupled from textarea DOM manipulation.
3. In `InputBar`, define `onFinalResult`: read `textareaRef.current.selectionStart`, splice the final transcript into `text` at that position, update state via `setText()`, then set the cursor position to just after the inserted text (via `useEffect` + `setSelectionRange`).
4. Track the cursor insertion point in a `useRef<number>` (`cursorRef`). Update it on `onSelect` / `onClick` / `onKeyUp` events on the textarea so it always reflects the user's last known cursor position.
5. Display `interimText` by appending it visually after the cursor position. The simplest approach: concatenate `text.slice(0, cursor) + interimText + text.slice(cursor)` as the textarea value, but track that the interim portion is ephemeral. When a final result arrives, the interim portion is replaced.
6. To distinguish interim text visually: since a plain `<textarea>` can't style substrings, use opacity or a subtle indicator near the mic button (e.g., "Listening..." label) rather than inline styling. The interim text appears as regular text in the textarea but is replaced on finalization — this is acceptable for Phase 1.

**Tests:**
- `client/hooks/use-speech-recognition.test.ts` — When `onresult` fires with `isFinal: false`, `interimText` updates. When `isFinal: true`, `onFinalResult` callback is called with the transcript and `interimText` clears.
- `client/components/input-bar.test.ts` — Final transcript is inserted at cursor position within existing typed text. Cursor moves to end of inserted text.

## UC-5: Submit prompt via voice command

**Files:**
- `client/hooks/use-speech-recognition.ts` — detect trailing "send" keyword in final results
- `client/components/input-bar.tsx` — handle voice-triggered submit

**Steps:**
1. In `useSpeechRecognition`, add a second callback parameter: `onVoiceSubmit: (text: string) => void`. When a final result's transcript ends with the word "send" (case-insensitive, after trimming), strip "send" from the transcript, call `onVoiceSubmit(cleanedText)` instead of `onFinalResult`, and call `stop()`.
2. In `InputBar`, define `onVoiceSubmit`: insert the cleaned text at cursor position (same as `onFinalResult`), then trigger `handleSubmit()` after a microtask delay (to let state settle).
3. Edge case: if the only word spoken is "send" and the textarea is otherwise empty, do not submit (no content to send).

**Tests:**
- `client/hooks/use-speech-recognition.test.ts` — Final result ending with "send" calls `onVoiceSubmit` with the word stripped. Final result ending with "Send" (case-insensitive) also triggers. Result "send" alone with empty textarea does not trigger submission.

## UC-7: Handle microphone permission denied

**Files:**
- `client/hooks/use-speech-recognition.ts` — handle `onerror` for `not-allowed` error type
- `client/components/input-bar.tsx` — display error state on mic button
- `client/style.css` — error state styling for mic button, tooltip

**Steps:**
1. In `useSpeechRecognition`, attach an `onerror` handler. When `event.error === 'not-allowed'`, set `error` state to `'permission-denied'`, set `isListening` to `false`.
2. In `InputBar`, when `error === 'permission-denied'`, apply `.input-bar__btn--mic--error` class to the mic button. Show a tooltip (via `title` attribute or a small absolute-positioned label) explaining: "Microphone access denied. Enable it in your browser settings."
3. The mic button remains visible but in an error state. Clicking it again re-attempts `recognition.start()` (in case the user has since changed permissions).

**Tests:**
- `client/hooks/use-speech-recognition.test.ts` — When `onerror` fires with `error: 'not-allowed'`, `error` is set to `'permission-denied'` and `isListening` is `false`.

## UC-9: Recover from mid-dictation error

**Files:**
- `client/hooks/use-speech-recognition.ts` — handle `onerror` for non-permission errors

**Steps:**
1. In the `onerror` handler, for errors other than `'not-allowed'` (e.g., `'network'`, `'audio-capture'`, `'no-speech'`): set `error` to the error type string, set `isListening` to `false`. Do not clear the textarea — all committed text remains.
2. The `interimText` is kept as-is in the textarea (not cleared) since it was already inserted into the textarea value.
3. In `InputBar`, when `error` is set (and not `'permission-denied'`), briefly show a non-blocking notification. Simplest approach: display a small label near the mic button that auto-dismisses after 3 seconds (via `setTimeout` + state).
4. Clear the `error` state when the user clicks the mic button to retry.

**Tests:**
- `client/hooks/use-speech-recognition.test.ts` — When `onerror` fires with `error: 'network'`, `error` is set and `isListening` is `false`. Previously committed text is unaffected.

## UC-10: Auto-restart on silence timeout

**Files:**
- `client/hooks/use-speech-recognition.ts` — distinguish error-end from silence-end in `onend`

**Steps:**
1. In the `onend` handler, check if the user explicitly stopped (track via a `stoppedManually` ref set in `stop()`). If not manually stopped and no error is pending, call `recognition.start()` again to auto-restart. Keep `isListening` as `true`.
2. Reset the `stoppedManually` ref to `false` after each `start()` call.
3. Guard against rapid restart loops: if `onend` fires immediately after `start()` (within ~100ms), don't restart (likely indicates a persistent error).

**Tests:**
- `client/hooks/use-speech-recognition.test.ts` — When `onend` fires without a preceding `stop()` call and no error, `recognition.start()` is called again. When `onend` fires after `stop()`, no restart occurs.
