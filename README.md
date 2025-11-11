# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/d96b37a3-c31f-469e-a274-587974d11065

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/d96b37a3-c31f-469e-a274-587974d11065) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- OpenAI API (for chat functionality)

## OpenAI API Setup

To use the chat functionality, create a `.env.local` file in the root directory and add your OpenAI API key:

```bash
# Create .env.local file
echo "VITE_OPENAI_API_KEY=your_openai_api_key_here" > .env.local
```

Or manually create `.env.local` file with:

```
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

Restart the development server after creating the file.

## Running the API Server

The chat functionality requires a backend API server to communicate with OpenAI. To run the API server:

```bash
# Navigate to the api directory
cd api

# Install dependencies
npm install

# Create .env file with your OpenAI API key
echo "OPENAI_API_KEY=your-openai-api-key-here" > .env

# Start the API server
npm start
```

The API server will run on `http://localhost:1041`.

**⚠️ IMPORTANT:** Without a valid OpenAI API key, the chat will return demo/mock responses only. To get real AI responses, you must:

1. Get an OpenAI API key from https://platform.openai.com/api-keys
2. Create `api/.env` file with: `OPENAI_API_KEY=sk-your-actual-key-here`
3. Restart the API server

**Current behavior:** If no API key is set, the system returns a demo message: *"Привет! Я Галина, ваш AI-юрист. Я помогу вам с юридическими вопросами. Задайте мне любой вопрос о законодательстве Российской Федерации."*

## Streaming API Features

This application supports real-time streaming responses from OpenAI:

- **Live text generation**: AI responses appear word by word as they're generated
- **Reduced latency**: First tokens appear immediately instead of waiting for complete response
- **Better UX**: Users can see the AI "thinking" and generating content in real-time
- **Fallback support**: If no OpenAI API key is provided, mock streaming is used for testing

### Streaming Technical Details

- Uses OpenAI's `stream: true` parameter with Server-Sent Events (SSE)
- Frontend processes streaming data chunks and updates UI incrementally
- Supports both GPT-3.5-turbo and GPT-4o models with streaming
- Automatic fallback to mock streaming when API key is not configured

The frontend development server typically runs on `http://localhost:8080` (or another available port).

**Note**: The chat uses GPT-3.5-turbo model and is configured to provide legal advice in Russian based on Russian legislation.

## File Upload Features

The chat supports file uploads for enhanced legal document analysis:

- **Supported file types**: Images (JPEG, PNG, WebP), PDF, TXT, DOC, DOCX
- **Maximum file size**: 10MB per file
- **Multiple files**: Upload multiple files at once
- **AI analysis**: Images are analyzed using GPT-4 Vision API, text documents are processed with GPT-3.5-turbo

Files are processed securely and not stored permanently on the server.

## Voice Input Features

The chat supports voice input for hands-free communication:

- **Voice recording**: Click the microphone button to start recording (3-5 seconds)
- **Automatic transcription**: Voice is automatically converted to text (currently simulated)
- **Visual feedback**: Recording indicator with pulsing red dot and red button
- **Smart button switching**: Microphone button changes to send button when text is entered
- **Auto-complete recording**: Recording stops automatically after 3-5 seconds
- **Random responses**: Each recording generates different sample legal questions

The voice input feature enhances accessibility and provides an alternative input method for users.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/d96b37a3-c31f-469e-a274-587974d11065) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
