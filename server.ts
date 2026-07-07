import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import OpenAI from "openai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  const USE_GEMINI = process.env.GEMINI === "true";
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy" });
  
  // NVIDIA NIM API setup
  const openai = new OpenAI({
    apiKey: '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',
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { history, message } = req.body;
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      if (USE_GEMINI) {
        const contents = history.map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        }));

        contents.push({
          role: 'user',
          parts: [{ text: message }]
        });

        const responseStream = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          config: {
            systemInstruction: "You are an AI named Whale. You provide clear, aesthetic, and concise answers. Always use markdown formatting, especially for code blocks, bold text, and highlights, so the frontend can parse and display it beautifully."
          },
          contents: contents,
        });

        for await (const chunk of responseStream) {
          if (chunk.text) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
          }
        }
      } else {
        // Use NVIDIA NIM
        const messages = [
          { role: "system", content: "You are an AI named Whale. You provide clear, aesthetic, and concise answers. Always use markdown formatting." },
          ...history.map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.text
          })),
          { role: "user", content: message }
        ];

        const stream = await openai.chat.completions.create({
          model: "meta/llama-3.1-70b-instruct",
          messages: messages as any,
          stream: true,
          max_tokens: 1024
        });

        for await (const chunk of stream) {
          if (chunk.choices[0]?.delta?.content) {
            res.write(`data: ${JSON.stringify({ text: chunk.choices[0].delta.content })}\n\n`);
          }
        }
      }
      
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error("Chat API error:", error);
      res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
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
            { role: 'user', parts: [{ text: `Generate a short title (2-4 words) for a chat that starts with this message: "${message}". Do not use quotes.` }] }
          ],
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
    } catch (error: any) {
      console.error("Title API error:", error);
      res.status(500).json({ error: "Failed to generate title" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
