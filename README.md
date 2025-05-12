# Agility

Agility is a powerful workflow automation platform that allows you to create, visualize, and share AI agent workflows through an intuitive drag-and-drop interface. Connect different AI agents to automate complex tasks across various services like Gmail, GitHub, and Discord.

## Features

- 🎨 **Visual Workflow Builder**: Create workflows using a drag-and-drop interface
- 🤖 **AI Agents**: Pre-built agents for common tasks:
  - Text Generator: Generate and refine text using AI models
  - Gmail Reader: Read and process emails
  - Gmail Sender: Send automated emails
  - Discord Messenger: Send messages to Discord channels
  - GitHub Reader: Monitor repository changes and commits
- 🔄 **Workflow Templates**: Start quickly with pre-built workflow templates
- 🔌 **Service Integrations**: Seamless integration with popular services
- 🔒 **Secure**: Built-in authentication and secure credential management
- 🎯 **Customizable**: Configure agents to match your specific needs

## Tech Stack

- **Frontend**: Next.js, React, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Edge Functions, Database)
- **Authentication**: Supabase Auth
- **Deployment**: Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- A Supabase account
- Required API keys for services you plan to use:
  - OpenAI API key (for Text Generator)
  - GitHub Personal Access Token (for GitHub Reader)
  - Discord Webhook URL (for Discord Messenger)
  - Gmail OAuth credentials (for Gmail agents)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/agility.git
cd agility
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
bun install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory with the following variables:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
# or
yarn dev
# or
bun dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Create a Workflow**:
   - Click "Try the Workflow Builder" on the homepage
   - Drag agents from the left panel onto the canvas
   - Connect agents by dragging from one agent's output to another's input

2. **Configure Agents**:
   - Click on an agent to open its configuration panel
   - Set up required credentials and parameters
   - Test the agent configuration before saving

3. **Run Workflows**:
   - Test individual agents using the "Test Agent" button
   - Run the entire workflow using the "Test Workflow" button
   - Monitor execution results in real-time

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org)
- Styled with [Tailwind CSS](https://tailwindcss.com)
- Powered by [Supabase](https://supabase.com)
