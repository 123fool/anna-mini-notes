package tool

const Name = "tool-mini-notes-summarizer-local"
const Version = "0.1.1"
const Executable = "mini-notes-summarizer"

func Manifest() map[string]any {
	return map[string]any{
		"name": Name, "display_name": "Mini Notes Summarizer", "version": Version,
		"description":       "Summarize supplied notes using the host LLM, without an API key.",
		"host_capabilities": []string{"llm.sample"},
		"tools": []any{map[string]any{
			"name": "summarize", "description": "Return a concise summary of the supplied notes.",
			"parameters": []any{map[string]any{"name": "text", "type": "string", "required": true, "description": "Notes in their original order."}},
		}},
		"runtime": map[string]any{"type": "binary", "binary": map[string]any{
			"entrypoint":  map[string]string{"default": "bin/" + Executable, "windows-x86_64": "bin/" + Executable + ".exe"},
			"permissions": map[string]string{"bin/" + Executable: "0o755"},
		}},
	}
}
