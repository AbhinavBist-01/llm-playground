"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Trash2,
  Settings2,
  Zap,
  Activity,
  DollarSign,
  Cpu,
  Layers,
  Code2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Copy,
  Terminal,
} from "lucide-react";

const AVAILABLE_MODELS = [
  { id: "gpt-4o-mini", name: "GPT-4o Mini", desc: "Fast & cost-efficient" },
  { id: "gpt-4o", name: "GPT-4o", desc: "Flagship omni model" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", desc: "Complex reasoning" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", desc: "Legacy fast model" },
];

export default function LLMPlayground() {
  // Playground Parameters
  const [model, setModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [stream, setStream] = useState(true);
  const [responseFormatJson, setResponseFormatJson] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful and concise AI assistant."
  );

  // Chat & Messages State
  const [messages, setMessages] = useState([
    {
      id: "init-1",
      role: "user",
      content: "Explain the difference between temperature and top-p sampling in 2 concise points.",
    },
    {
      id: "init-2",
      role: "assistant",
      content:
        "1. Temperature flattens or sharpens the entire probability distribution over vocabulary—lower values make high-probability tokens even more dominant.\n2. Top-p (nucleus sampling) dynamically truncates the candidate pool to only the smallest subset of tokens whose cumulative probability reaches threshold p.",
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  // Observability & Telemetry State
  const [telemetry, setTelemetry] = useState({
    model: "gpt-4o-mini",
    inputTokens: 38,
    outputTokens: 52,
    latency: 340,
    cost: 0.000037,
  });

  const [showConcepts, setShowConcepts] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Live Token Estimator (~4 chars = 1 token)
  const estimateTokens = (text) => {
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.trim().length / 4));
  };

  const totalInputTokensEstimate =
    estimateTokens(systemPrompt) +
    messages.reduce((acc, m) => acc + estimateTokens(m.content), 0) +
    estimateTokens(inputPrompt);

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([]);
    setErrorMsg("");
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!inputPrompt.trim() || isLoading) return;

    setErrorMsg("");
    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputPrompt.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputPrompt("");
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();

    // Prepare API messages payload (omit UI ids)
    const apiMessages = newMessages.map(({ role, content }) => ({
      role,
      content,
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: apiMessages,
          systemPrompt,
          temperature: Number(temperature),
          topP: Number(topP),
          maxTokens: Number(maxTokens),
          stream,
          responseFormatJson,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Server returned error ${response.status}`
        );
      }

      if (stream) {
        // Create empty assistant message container
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.replace("data: ", "").trim());
                if (parsed.type === "chunk" && parsed.content) {
                  accumulated += parsed.content;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? { ...msg, content: accumulated }
                        : msg
                    )
                  );
                } else if (parsed.type === "done") {
                  if (parsed.telemetry) {
                    setTelemetry(parsed.telemetry);
                  }
                } else if (parsed.type === "error") {
                  throw new Error(parsed.error);
                }
              } catch (err) {
                // Ignore parse errors on partial chunk borders
              }
            }
          }
        }
      } else {
        // Non-streaming response
        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: data.text },
        ]);
        if (data.telemetry) {
          setTelemetry(data.telemetry);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Request failed. Check server and API key.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur px-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-white text-black flex items-center justify-center font-bold text-sm tracking-tighter">
            Ω
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-wide text-zinc-100">
              BOSS 3
            </span>
            <span className="text-zinc-600">/</span>
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-mono">
              LLM Playground
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Online
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConcepts(!showConcepts)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Concepts
          </button>
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-red-400 transition"
            title="Clear conversation history"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Chat
          </button>
        </div>
      </header>

      {/* Concepts Drawer */}
      {showConcepts && (
        <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs animate-in slide-in-from-top duration-150">
          <div>
            <div className="font-semibold text-zinc-200 mb-1">LLM Inference & Sampling</div>
            <p className="text-zinc-400 leading-relaxed">
              <strong>Temperature</strong> flattens token logits for diversity. <strong>Top-p</strong> restricts sampling to the cumulative probability mass.
            </p>
          </div>
          <div>
            <div className="font-semibold text-zinc-200 mb-1">Context Windows</div>
            <p className="text-zinc-400 leading-relaxed">
              Every turn accumulates input tokens (System + Past Messages + User Input) bounded by model limits.
            </p>
          </div>
          <div>
            <div className="font-semibold text-zinc-200 mb-1">Streaming (SSE)</div>
            <p className="text-zinc-400 leading-relaxed">
              Server-Sent Events deliver delta tokens chunk by chunk with minimal Time to First Token (TTFT).
            </p>
          </div>
          <div>
            <div className="font-semibold text-zinc-200 mb-1">Structured Outputs & Cost</div>
            <p className="text-zinc-400 leading-relaxed">
              JSON mode guarantees parsable outputs. Observability tracks cost = (inputs × rate) + (outputs × rate).
            </p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left / Center: Chat & Observability Dashboard */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-zinc-800">
          {/* Chat History Viewport */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* System Prompt Banner */}
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-lg p-3 text-xs">
              <div className="flex items-center justify-between text-zinc-400 mb-1.5 font-mono">
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <Terminal className="w-3.5 h-3.5" /> SYSTEM PROMPT
                </span>
                <span>~{estimateTokens(systemPrompt)} tokens</span>
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={2}
                placeholder="Set instructions for model behavior..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 resize-none font-mono"
              />
            </div>

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-md text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{errorMsg}</div>
              </div>
            )}

            {/* Messages Stream */}
            {messages.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-zinc-600 text-xs">
                <Code2 className="w-8 h-8 mb-2 stroke-[1.5]" />
                <p>Start a conversation to inspect tokens, latency, and costs.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider ${
                        msg.role === "user"
                          ? "text-zinc-400 font-semibold"
                          : "text-zinc-500"
                      }`}
                    >
                      {msg.role}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-600">
                      ~{estimateTokens(msg.content)} tokens
                    </span>
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="text-zinc-600 hover:text-zinc-300 p-0.5 rounded"
                      title="Copy message"
                    >
                      {copiedId === msg.id ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-lg p-3.5 text-xs leading-relaxed whitespace-pre-wrap break-words border ${
                      msg.role === "user"
                        ? "bg-zinc-900 border-zinc-700 text-zinc-100"
                        : "bg-zinc-950 border-zinc-800 text-zinc-300 font-mono"
                    }`}
                  >
                    {msg.content || (
                      <span className="inline-flex items-center gap-1 text-zinc-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-ping"></span>
                        Thinking...
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Telemetry Dashboard & Prompt Bar */}
          <div className="border-t border-zinc-800 bg-zinc-950 p-4 space-y-3">
            {/* Telemetry Tree Card */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 text-xs font-mono">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2 text-zinc-400">
                <span className="flex items-center gap-2 font-semibold text-zinc-200">
                  <Activity className="w-3.5 h-3.5 text-white" />
                  REQUEST TELEMETRY & OBSERVABILITY
                </span>
                <span className="text-[10px] text-zinc-500">Last Execution</span>
              </div>

              {/* ASCII Tree representation as requested */}
              <div className="text-[11px] text-zinc-300 leading-snug space-y-0.5 bg-black/40 p-2.5 rounded border border-zinc-900">
                <div className="text-zinc-400">Request</div>
                <div className="flex items-center justify-between">
                  <span>├── input tokens</span>
                  <span className="text-white font-semibold">
                    {telemetry.inputTokens}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>├── output tokens</span>
                  <span className="text-white font-semibold">
                    {telemetry.outputTokens}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>├── latency</span>
                  <span className="text-white font-semibold">
                    {telemetry.latency} ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>├── cost</span>
                  <span className="text-emerald-400 font-semibold">
                    ${telemetry.cost?.toFixed(6) || "0.000000"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>└── model</span>
                  <span className="text-zinc-300 font-semibold">
                    {telemetry.model}
                  </span>
                </div>
              </div>
            </div>

            {/* Prompt Submission Input */}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  rows={2}
                  disabled={isLoading}
                  placeholder="Enter message or prompt (Enter to send, Shift+Enter for newline)..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none pr-28 disabled:opacity-50"
                />
                <span className="absolute bottom-2 right-2 text-[10px] font-mono text-zinc-500">
                  est. ~{estimateTokens(inputPrompt)} tokens
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading || !inputPrompt.trim()}
                className="px-4 bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shrink-0"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Run</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Sidebar: Sampling Controls & Specs */}
        <aside className="w-80 shrink-0 bg-zinc-950 p-5 overflow-y-auto space-y-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider border-b border-zinc-800 pb-3">
            <Settings2 className="w-4 h-4 text-white" />
            Parameters & Config
          </div>

          {/* Model Selector */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label className="text-zinc-300 font-medium">Model</label>
            </div>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 font-mono"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.desc})
                </option>
              ))}
            </select>
          </div>

          {/* Temperature Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="text-zinc-300 font-medium">Temperature</label>
              <span className="font-mono text-zinc-400">{temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-white bg-zinc-800 h-1 rounded cursor-pointer"
            />
            <p className="text-[11px] text-zinc-500">
              0.0 = completely deterministic, 2.0 = highly creative.
            </p>
          </div>

          {/* Top-P Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="text-zinc-300 font-medium">Top-P</label>
              <span className="font-mono text-zinc-400">{topP}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={topP}
              onChange={(e) => setTopP(parseFloat(e.target.value))}
              className="w-full accent-white bg-zinc-800 h-1 rounded cursor-pointer"
            />
            <p className="text-[11px] text-zinc-500">
              Nucleus sampling threshold. Alternatives considered inside cumulative top p mass.
            </p>
          </div>

          {/* Max Output Tokens */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="text-zinc-300 font-medium">Max Tokens</label>
              <span className="font-mono text-zinc-400">{maxTokens}</span>
            </div>
            <input
              type="range"
              min="64"
              max="4096"
              step="64"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="w-full accent-white bg-zinc-800 h-1 rounded cursor-pointer"
            />
            <p className="text-[11px] text-zinc-500">
              Upper bound on generated response token count.
            </p>
          </div>

          <div className="border-t border-zinc-800 pt-4 space-y-4">
            {/* Streaming Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs text-zinc-300 font-medium block">
                  Streaming
                </label>
                <span className="text-[10px] text-zinc-500">
                  Stream tokens via SSE
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStream(!stream)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  stream ? "bg-white" : "bg-zinc-800"
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full bg-black absolute top-0.5 transition-transform ${
                    stream ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Structured JSON Output Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs text-zinc-300 font-medium block">
                  Structured JSON
                </label>
                <span className="text-[10px] text-zinc-500">
                  Force json_object format
                </span>
              </div>
              <button
                type="button"
                onClick={() => setResponseFormatJson(!responseFormatJson)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  responseFormatJson ? "bg-white" : "bg-zinc-800"
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full bg-black absolute top-0.5 transition-transform ${
                    responseFormatJson ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Context Window & Token Summary */}
          <div className="border-t border-zinc-800 pt-4 space-y-2">
            <div className="text-xs font-medium text-zinc-300">
              Total Conversation Tokens
            </div>
            <div className="flex justify-between text-xs font-mono text-zinc-400">
              <span>Estimated Context</span>
              <span className="text-zinc-200">~{totalInputTokensEstimate} tokens</span>
            </div>
            <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="bg-zinc-400 h-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    (totalInputTokensEstimate / 4096) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
