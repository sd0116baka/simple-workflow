const FULL_JSON_FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
const EMBEDDED_JSON_FENCE_PATTERN = /```(?:json)?\s*([\s\S]*?)\s*```/i;

export function extractAgentJsonOutputText(output, {
  allowEmbeddedFence = false,
} = {}) {
  const text = String(output ?? "").trim();
  const pattern = allowEmbeddedFence
    ? EMBEDDED_JSON_FENCE_PATTERN
    : FULL_JSON_FENCE_PATTERN;
  const fenced = text.match(pattern);

  return fenced ? fenced[1].trim() : text;
}
