# Whale AI 🐋

Welcome to Whale AI, a minimal, beautifully designed, and highly aesthetic conversational AI interface built to feel completely native, light, and unobtrusive. 

I built this project because I wanted an interface that didn't feel cluttered with typical chat UI patterns. The primary goal was to achieve a clean "slate" that brings the focus entirely to the conversation with the AI model. 

## Structure and Tech Stack

The architecture is kept extremely lightweight, separating the core interactive layer from the ambient background:

- **Frontend**: React (Vite) + Tailwind CSS for styling. I've custom-tailored the Markdown rendering so code blocks and prose have a very distinct, polished look.
- **Backend/API Proxy**: A minimal Express.js backend inside `server.ts` handles the API calls securely. It's bundled seamlessly.
- **Native Wrap**: Capacitor is used so this can effortlessly deploy as an iOS or Android app while retaining a native feel, complete with local persistence using `@capacitor/preferences`.
- **Background Engine**: A custom WebGL shader (found in `WebGLBackground.tsx`) powers the fluid, distorted glitch-wave background. It creates a subtle but engaging ambiance.
- **Speech**: Integrated Web Speech API for voice interactions, giving it a much more accessible and conversational flow.

## Getting Started Locally

1. **Environment Variables**:
   You'll need to set up your `.env` file at the root of the project to authenticate with the AI model.
   ```
   GEMINI_API_KEY="your_api_key_here"
   ```
   This handles the core LLM processing in the backend proxy.

2. **Run the Dev Server**:
   Once your `.env` is set up, install dependencies and start the local environment:
   ```bash
   npm install
   npm run dev
   ```

3. **Production Build**:
   ```bash
   npm run build
   ```

## Deploying as a Native App (Capacitor)

Because I built this to work cross-platform, you can easily compile it down to a native app using Capacitor.

1. **Build the web assets**:
   ```bash
   npm run build
   ```

2. **Sync the assets with the native platforms**:
   ```bash
   npx cap sync
   ```
   *Note: If you run into issues with a platform already existing, you can wipe it and re-add it.*

3. **Open in your native IDE**:
   For iOS:
   ```bash
   npx cap open ios
   ```
   For Android:
   ```bash
   npx cap open android
   ```

## Design Notes

A lot of attention went into the transitions, the blur overlays during chat history, and the subtle shimmer effects on generating states. I kept the color palette muted—primarily off-whites (`#f4f3ed`), deep charcoals (`#2d2d2d`), and a striking coral/peach accent for code blocks. 

Feel free to fork this, learn from it, or rip it apart for your own projects!
