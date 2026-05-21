export function truncateTerminalLine(text, maxLength = 4000) {
  const value = String(text ?? "");
  return value.length > maxLength
    ? `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} chars]`
    : value;
}
