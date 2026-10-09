import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files from src/frontend
app.use(express.static(path.join(__dirname, "../frontend")));

const PORT = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy-key",
});

const VALID_ROLES = ["system", "user", "assistant", "developer"];

// Pricing per 1M tokens in USD
const MODEL_PRICING = {
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4-turbo": { inputPer1M: 10.0, outputPer1M: 30.0 },
  "gpt-3.5-turbo": { inputPer1M: 0.5, outputPer1M: 1.5 },
};

function calculateCost(model, inputTokens, outputTokens) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING["gpt-4o-mini"];
  const inputCost = (inputTokens * pricing.inputPer1M) / 1_000_000;
  const outputCost = (outputTokens * pricing.outputPer1M) / 1_000_000;
  return Number((inputCost + outputCost).toFixed(6));
}

// Simple fallback token estimator (~4 chars per token)
function estimateTokens(text) {
  if (!text) return 0;
  if (typeof text !== "string") {
    text = JSON.stringify(text);
  }
  return Math.max(1, Math.ceil(text.length / 4));
}

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({
        error: "OPENAI_API_KEY is not set in your .env file. Please add OPENAI_API_KEY to run completions.",
      });
    }

    // 1. Extract values from req.body
    const {
      model,
      messages,
      systemPrompt = "You are a helpful assistant.",
      temperature = 0.7,
      topP = 1,
      maxTokens = 500,
      stream = false,
      responseFormatJson = false,
    } = req.body || {};

    // 2. Validate
    if (!model || typeof model !== "string" || !model.trim()) {
      return res.status(400).json({
        error: "model is required and must be a non-empty string",
      });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "messages is required and must be an array",
      });
    }

    if (messages.length === 0) {
      return res.status(400).json({
        error: "messages array cannot be empty",
      });
    }

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || typeof msg !== "object") {
        return res.status(400).json({
          error: `Message at index ${i} must be an object`,
        });
      }

      if (
        !msg.role ||
        typeof msg.role !== "string" ||
        !VALID_ROLES.includes(msg.role)
      ) {
        return res.status(400).json({
          error: `Message at index ${i} has an invalid role. Valid roles are: ${VALID_ROLES.join(", ")}`,
        });
      }

      if (typeof msg.content !== "string" || !msg.content.trim()) {
        return res.status(400).json({
          error: `Message at index ${i} must have non-empty content`,
        });
      }
    }

    if (
      typeof temperature !== "number" ||
      Number.isNaN(temperature) ||
      temperature < 0 ||
      temperature > 2
    ) {
      return res.status(400).json({
        error: "temperature must be a number between 0 and 2",
      });
    }

    if (
      typeof topP !== "number" ||
      Number.isNaN(topP) ||
      topP < 0 ||
      topP > 1
    ) {
      return res.status(400).json({
        error: "topP must be a number between 0 and 1",
      });
    }

    if (
      typeof maxTokens !== "number" ||
      !Number.isInteger(maxTokens) ||
      maxTokens <= 0
    ) {
      return res.status(400).json({
        error: "maxTokens must be a positive integer",
      });
    }

    // 3. Prepare formatted messages array (prepend system prompt)
    const formattedMessages = [];
    if (systemPrompt && typeof systemPrompt === "string" && systemPrompt.trim()) {
      formattedMessages.push({
        role: "system",
        content: systemPrompt.trim(),
      });
    }
    formattedMessages.push(...messages);

    const callPayload = {
      model,
      messages: formattedMessages,
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
      ...(responseFormatJson ? { response_format: { type: "json_object" } } : {}),
    };

    const start = Date.now();

    // 4. Handle Streaming
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      const streamResponse = await client.chat.completions.create({
        ...callPayload,
        stream: true,
        stream_options: { include_usage: true },
      });

      let accumulatedText = "";
      let usage = null;

      for await (const chunk of streamResponse) {
        if (res.writableEnded || req.socket?.destroyed) break;
        const deltaContent = chunk.choices?.[0]?.delta?.content || "";
        if (deltaContent) {
          accumulatedText += deltaContent;
          res.write(`data: ${JSON.stringify({ type: "chunk", content: deltaContent })}\n\n`);
        }
        if (chunk.usage) {
          usage = chunk.usage;
        }
      }

      if (res.writableEnded || req.socket?.destroyed) return;

      const latency = Date.now() - start;
      const inputTokens = usage?.prompt_tokens ?? estimateTokens(formattedMessages);
      const outputTokens = usage?.completion_tokens ?? estimateTokens(accumulatedText);
      const cost = calculateCost(model, inputTokens, outputTokens);

      const telemetry = {
        model,
        inputTokens,
        outputTokens,
        latency,
        cost,
      };

      res.write(
        `data: ${JSON.stringify({
          type: "done",
          text: accumulatedText,
          telemetry,
        })}\n\n`
      );
      return res.end();
    }

    // 5. Handle Standard (Non-streaming)
    const response = await client.chat.completions.create(callPayload);
    const latency = Date.now() - start;

    const outputText = response.choices?.[0]?.message?.content ?? "";
    const inputTokens = response.usage?.prompt_tokens ?? estimateTokens(formattedMessages);
    const outputTokens = response.usage?.completion_tokens ?? estimateTokens(outputText);
    const cost = calculateCost(model, inputTokens, outputTokens);

    const telemetry = {
      model: response.model || model,
      inputTokens,
      outputTokens,
      latency,
      cost,
    };

    return res.json({
      text: outputText,
      model: response.model || model,
      usage: response.usage,
      latency,
      cost,
      telemetry,
    });
  } catch (error) {
    console.error("Error in /api/chat:", error);

    // If headers already sent in streaming mode, finish the stream with error
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: "error", error: error.message || "Something went wrong" })}\n\n`);
      return res.end();
    }

    res.status(500).json({
      error: error.message || "Something went wrong",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
