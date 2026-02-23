# Voice Dictation

Exploring adding voice dictation to the Conclave chat input so users can speak prompts instead of typing.

## Findings

### Integration Point

The InputBar component (`client/components/input-bar.tsx`) owns a `text` state with `setText`. Voice dictation just needs to call `setText()` with interim/final results from the Web Speech API. No server changes needed — this is purely client-side.

The component already has a `forwardRef` pattern exposing `InputBarHandle` for external interaction (image paste). The microphone button lives alongside the existing Send/Stop buttons.

### Approach: Web Speech API

Browser-native `SpeechRecognition` (Chrome/Edge). Zero dependencies, streaming interim results.

**How it works:**
- `SpeechRecognition` fires `onresult` events with `isFinal: false` (interim) and `isFinal: true` (committed)
- `continuous: true` keeps listening across pauses
- `interimResults: true` enables streaming text as user speaks

**Known limitations:**
- No custom vocabulary — technical jargon may be misrecognized
- Session timeouts after ~60s of silence (need auto-restart)
- Browser support: Chrome/Edge (good), Firefox/Safari (poor/none)
- Auto-punctuation is inconsistent

### UX Considerations

- Microphone toggle button next to Send/Stop
- Visual feedback for "listening" state
- Interim results stream into textarea in real-time
- Final results replace interim text
- Typed text and dictated text coexistence: append dictated text at cursor or end

### Error States and Edge Cases

- **Permission denied:** Browser prompts for mic access on first use. If denied, the mic button should show a disabled/error state with a tooltip explaining how to re-enable.
- **Unsupported browser:** Firefox and Safari have limited/no `SpeechRecognition` support. The mic button should be hidden entirely when the API is unavailable (`!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)`).
- **Mid-dictation disconnect:** Network loss or session timeout mid-speech — `onerror` and `onend` events fire. Should gracefully stop listening and keep whatever text was captured.
- **No audio input:** If the system has no microphone, `onerror` fires with `error: 'audio-capture'`. Same handling as permission denied.
- **Accessibility:** The listening state needs an `aria-live` region or `aria-label` update so screen readers announce when dictation starts/stops.

### Accuracy Assessment

For this use case (natural language prompts to Claude Code), accuracy is acceptable. Users say things like "refactor the auth module to use JWT tokens" — the Speech API handles conversational English reasonably well. It struggles with literal code syntax, but that's not the primary input mode.

### Transcript Quality Gaps

Web Speech API has no punctuation model — output is a flat stream of words. For short prompts this is fine, but longer dictations lose readability without commas and periods. A post-processing step (e.g., sending the raw transcript through an LLM with "add punctuation and fix obvious misrecognitions") could improve quality. This is low-priority since most prompts are 1-2 sentences, but worth revisiting if users adopt voice input for longer instructions.

## Leanings

- Start with Web Speech API — simplest path, no dependencies, streaming support
- Keep it self-contained in InputBar (button + hook)
- Accept browser-native accuracy for now — transcript quality gaps (see findings) are tolerable for short prompts
- Phase 1: working mic button with streaming. Phase 2 (if users adopt voice for longer input): LLM-based transcript polishing to add punctuation and fix misrecognitions.

## Open Questions

- Should dictated text insert at the cursor position or always append at the end of existing text?
- Whether to auto-submit when user stops speaking, or always require manual Send
- Visual design of the mic button and "listening" indicator
