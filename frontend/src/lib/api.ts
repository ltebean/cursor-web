const getApiUrl = () => {
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:8010`;
  }
  return "http://localhost:8010";
};

export async function fetchModels() {
  const res = await fetch(`${getApiUrl()}/api/models`);
  return res.json();
}

export async function fetchConversations() {
  const res = await fetch(`${getApiUrl()}/api/conversations`);
  return res.json();
}

export async function fetchConversation(id: string) {
  const res = await fetch(`${getApiUrl()}/api/conversations/${id}`);
  return res.json();
}

export async function deleteConversation(id: string) {
  const res = await fetch(`${getApiUrl()}/api/conversations/${id}`, {
    method: "DELETE",
  });
  return res.json();
}

export async function browseDirectory(path: string) {
  const res = await fetch(
    `${getApiUrl()}/api/browse?path=${encodeURIComponent(path)}`
  );
  return res.json();
}

export async function createDirectory(path: string) {
  const res = await fetch(`${getApiUrl()}/api/mkdir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  return res.json();
}

export async function cancelExecution(conversationId: string) {
  const res = await fetch(`${getApiUrl()}/api/cancel/${conversationId}`, {
    method: "POST",
  });
  return res.json();
}

export interface ToolCallStartEvent {
  type: "tool_call_start";
  call_id: string;
  tool_type: string;
  command?: string;
  path?: string;
  content?: string;
  pattern?: string;
  query?: string;
}

export interface ToolCallDoneEvent {
  type: "tool_call_done";
  call_id: string;
  tool_type: string;
  command?: string;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  path?: string;
  message?: string;
  diff?: string;
  lines_added?: number;
  lines_removed?: number;
  total_lines?: number;
  pattern?: string;
  query?: string;
}

export interface ChatStreamCallbacks {
  onStart: (conversationId: string) => void;
  onThinkingDelta: (data: string) => void;
  onThinkingDone: () => void;
  onTextDelta: (data: string) => void;
  onToolCallStart: (event: ToolCallStartEvent) => void;
  onToolCallDone: (event: ToolCallDoneEvent) => void;
  onOutput: (data: string) => void;
  onDone: (exitCode: number) => void;
  onError: (message: string) => void;
}

export function streamChat(
  params: {
    prompt: string;
    working_dir: string;
    model: string;
    mode: string;
    conversation_id?: string;
  },
  callbacks: ChatStreamCallbacks,
  signal?: AbortSignal
) {
  const apiUrl = getApiUrl();

  fetch(`${apiUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const err = await response.json();
        callbacks.onError(err.error || "Request failed");
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              switch (data.type) {
                case "start":
                  callbacks.onStart(data.conversation_id);
                  break;
                case "thinking_delta":
                  callbacks.onThinkingDelta(data.data);
                  break;
                case "thinking_done":
                  callbacks.onThinkingDone();
                  break;
                case "text_delta":
                  callbacks.onTextDelta(data.data);
                  break;
                case "tool_call_start":
                  callbacks.onToolCallStart(data as ToolCallStartEvent);
                  break;
                case "tool_call_done":
                  callbacks.onToolCallDone(data as ToolCallDoneEvent);
                  break;
                case "output":
                  callbacks.onOutput(data.data);
                  break;
                case "done":
                  callbacks.onDone(data.exit_code);
                  break;
                case "error":
                  callbacks.onError(data.message);
                  break;
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        callbacks.onError(err.message || "Connection failed");
      }
    });
}
