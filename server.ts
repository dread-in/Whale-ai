import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  app.post("/api/chat", async (req, res) => {
    try {
      const { history, message } = req.body;
      
      const contents = history.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

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
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: 'user', parts: [{ text: `Generate a short title (2-4 words) for a chat that starts with this message: "${message}". Do not use quotes.` }] }
        ],
      });

      res.json({ title: response.text.trim() });
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
