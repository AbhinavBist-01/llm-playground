import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const VALID_ROLES = ["system", "user", "assistant", "developer"];

app.post("/api/chat", async (req, res) => {
  try {
    // 1. Extract values from req.body
    const {
      model,
      messages,
      systemPrompt = "You are a helpful assistant.",
      temperature = 0.7,
      topP = 1,
      maxTokens = 500,
    } = req.body || {};

    // 2. Validate
    // - model exists
    if (!model || typeof model !== "string" || !model.trim()) {
      return res.status(400).json({
        error: "model is required and must be a non-empty string",
      });
    }

    // - messages exists and is an array
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "messages is required and must be an array",
      });
    }

    // - messages isn't empty
    if (messages.length === 0) {
      return res.status(400).json({
        error: "messages array cannot be empty",
      });
    }

    // - every message has a valid role and non-empty content
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || typeof msg !== "object") {
        return res.status(400).json({
          error: `Message at index ${i} must be an object`,
        });
      }

      if (!msg.role || typeof msg.role !== "string" || !VALID_ROLES.includes(msg.role)) {
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

    // - validate parameter ranges
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

    // 3. Build the model request
    // Conceptually: system prompt + conversation messages -> LLM request

    // 5. Measure latency: start timer immediately before LLM call
    const start = Date.now();

    // 4. Call the LLM
    const response = await client.responses.create({
      model,
      instructions: systemPrompt,
      input: messages,
      temperature,
      top_p: topP,
      max_output_tokens: maxTokens,
    });

    // 5. Measure latency: stop timer immediately after
    const latency = Date.now() - start;

    // 6. Return
    res.json({
      text: response.output_text ?? response.text ?? response.choices?.[0]?.message?.content ?? "",
      model: response.model || model,
      usage: response.usage,
      latency,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message || "Something went wrong",
    });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
