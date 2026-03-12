# Arcano OS - Gemini Live Agent Challenge

## 🚀 Overview
Arcano Solutions presents **Arcana OS**, an elite multimodal AI agent designed for high-stakes corporate strategy and Google Cloud consultancy. Built for the **Gemini Live Agent Challenge**, Arcana OS moves beyond simple chat interfaces to provide a seamless "See, Hear, and Speak" experience.

## 🧠 Multimodal Capabilities
- **Hear**: Real-time voice processing using the Gemini Multimodal Live API (WebSocket).
- **See**: Neural Vision Core that analyzes diagrams, architectural whiteboard sessions, and documents via real-time camera stream.
- **Speak**: Low-latency, high-fidelity strategic advice with a professional "Senior Consultant" persona.
- **Interruption Support**: Natural "barge-in" capability where the agent gracefully stops to listen when the user speaks.

## 🛠️ Tech Stack
- **AI Model**: `gemini-2.0-flash` & `gemini-2.5-flash-native-audio-latest`.
- **Core Protocol**: WebSockets for bidirectional low-latency Multimodal Live interaction.
- **Frontend**: Vanilla JS, Three.js (Neural Particles), CSS3 (Antigravity System).
- **Backend**: Node.js / Express hosted on **Google Cloud**.
- **Services**: Vertex AI, Google Cloud Storage, Google Cloud Logging.

## 🏗️ Architecture Diagram
1. **Client (Browser)**: Captures Audio (AudioWorklet) + Video (MediaDevices) -> WebSocket Stream.
2. **Arcano Proxy (Node.js)**: Manages secure API Handshake + Environment Variables.
3. **Google Gemini Live API**: Processes multimodal chunks -> Returns Interleaved Audio/Text.
4. **Strategy Engine**: Gemini 1.5 Pro generates a post-session deep-dive report.

## 💻 Installation & Setup
1. **Clone the repo**: `git clone https://github.com/Arcano3Ai/arcano-web.git`
2. **Install dependencies**: `npm install`
3. **Environment Variables**: Create a `.env` file with:
   - `GEMINI_API_KEY=your_key_here`
   - `PORT=8080`
4. **Run local server**: `node server.js`
5. **Access**: `http://localhost:8080` (Use HTTPS for microphone access).

## 🏆 Challenge Compliance
- **English First**: Fully localized English primary interface with Spanish synchronization.
- **Multimodal**: Uses Video + Audio inputs.
- **Google Cloud Native**: Integrated with GCP infrastructure and Vertex AI logic.
- **Functionality**: Live interruption logic and automated strategy report generation.
