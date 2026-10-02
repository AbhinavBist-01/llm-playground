import express from "express";

const app = express();
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  try {
    const {
      model = "gpt-6-luna",
      systemPrompt = "You are a helpful assistant.",
      userPrompt,
      temperature = 0.7,
      topP = 1,
      maxTokens = 500,
    } = req.body;

    if (!userPrompt?.trim()) {
      return res.status(400).json({
        error: "User prompt is required",
      });
    }

    const start = Date.now();

    const response = await client.responses.create({
      model,
      instructions: systemPrompt,
      input: userPrompt,
      temperature,
      top_p: topP,
      max_output_tokens: maxTokens,
    });

    const latency = Date.now() - start;

    res.json({
      text: response.output_text,
      model: response.model,
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
