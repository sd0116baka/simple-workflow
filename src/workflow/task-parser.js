import YAML from "yaml";

export function parseRawTask(task) {
  try {
    return {
      parsed: YAML.parse(task.rawText),
      parseError: null,
    };
  } catch (error) {
    return {
      parsed: null,
      parseError: `YAML parse error: ${error.message}`,
    };
  }
}
