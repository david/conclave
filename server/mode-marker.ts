/**
 * Detects and extracts `[conclave:mode <modeId>]` markers from streaming AgentText chunks.
 *
 * Because text arrives in small chunks, the marker may span multiple chunks.
 * This module buffers text when a potential partial marker is detected at the
 * end of a chunk, and flushes it once the marker completes or is ruled out.
 */

const MARKER_RE = /\[conclave:mode\s+([a-z0-9_-]+)\]\n?/g;
const PARTIAL_RE = /\[(?:c(?:o(?:n(?:c(?:l(?:a(?:v(?:e(?::(?:m(?:o(?:d(?:e(?:\s(?:[a-z0-9_-]*)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?$/;

export type MarkerResult = {
  /** Text to forward as AgentText (marker stripped). May be empty. */
  text: string;
  /** Mode IDs found in the text, in order. */
  modeIds: string[];
};

export class ModeMarkerDetector {
  private buffer = "";

  /** Process an incoming text chunk. Returns text to emit and any mode switches found. */
  push(chunk: string): MarkerResult {
    this.buffer += chunk;
    return this.extract();
  }

  /** Flush any remaining buffered text (call on TurnCompleted). */
  flush(): MarkerResult {
    const result: MarkerResult = { text: this.buffer, modeIds: [] };
    this.buffer = "";
    return result;
  }

  private extract(): MarkerResult {
    const modeIds: string[] = [];

    // Extract all complete markers
    const cleaned = this.buffer.replace(MARKER_RE, (_match, modeId) => {
      modeIds.push(modeId);
      return "";
    });

    // Check if the end of the cleaned text could be a partial marker
    const partialMatch = cleaned.match(PARTIAL_RE);
    if (partialMatch && partialMatch[0].length > 0) {
      // Hold back the partial match in the buffer
      const safeText = cleaned.slice(0, partialMatch.index);
      this.buffer = partialMatch[0];
      return { text: safeText, modeIds };
    }

    // No partial — emit everything
    this.buffer = "";
    return { text: cleaned, modeIds };
  }
}
