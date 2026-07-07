var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_cors = __toESM(require("cors"), 1);
var import_openai = __toESM(require("openai"), 1);
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.use((0, import_cors.default)());
  const USE_GEMINI = process.env.GEMINI === "true";
  const ai = new import_genai.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy" });
  const openai = new import_openai.default({
    apiKey: "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",
    baseURL: "https://integrate.api.nvidia.com/v1"
  });
  app.post("/api/chat", async (req, res) => {
    try {
      const { history, message } = req.body;
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      if (USE_GEMINI) {
        const contents = history.map((msg) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text }]
        }));
        contents.push({
          role: "user",
          parts: [{ text: message }]
        });
        const responseStream = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          config: {
            systemInstruction: "You are an AI named Whale. You provide clear, aesthetic, and concise answers. Always use markdown formatting, especially for code blocks, bold text, and highlights, so the frontend can parse and display it beautifully."
          },
          contents
        });
        for await (const chunk of responseStream) {
          if (chunk.text) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}

`);
          }
        }
      } else {
        const messages = [
          { role: "system", content: "You are an AI named Whale. You provide clear, aesthetic, and concise answers. Always use markdown formatting." },
          ...history.map((msg) => ({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.text
          })),
          { role: "user", content: message }
        ];
        const stream = await openai.chat.completions.create({
          model: "meta/llama-3.1-70b-instruct",
          messages,
          stream: true,
          max_tokens: 1024
        });
        for await (const chunk of stream) {
          if (chunk.choices[0]?.delta?.content) {
            res.write(`data: ${JSON.stringify({ text: chunk.choices[0].delta.content })}

`);
          }
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      console.error("Chat API error:", error);
      res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}

`);
      res.end();
    }
  });
  app.post("/api/title", async (req, res) => {
    try {
      const { message } = req.body;
      if (USE_GEMINI) {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            { role: "user", parts: [{ text: `Generate a short title (2-4 words) for a chat that starts with this message: "${message}". Do not use quotes.` }] }
          ]
        });
        res.json({ title: response.text.trim() });
      } else {
        const response = await openai.chat.completions.create({
          model: "meta/llama-3.1-70b-instruct",
          messages: [{ role: "user", content: `Generate a short title (2-4 words) for a chat that starts with this message: "${message}". Do not use quotes.` }],
          max_tokens: 10
        });
        res.json({ title: response.choices[0].message.content?.trim() });
      }
    } catch (error) {
      console.error("Title API error:", error);
      res.status(500).json({ error: "Failed to generate title" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
