import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

// Force all pages to be dynamically rendered — nhost auth hooks require browser context
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'FlowMind — AI Agent Workflow Builder',
  description: 'Build, chain, and automate AI agent workflows with real-time monitoring, approval gates, and multi-org support.',
  keywords: 'AI workflow, agent automation, n8n alternative, LLM pipeline',
  openGraph: {
    title: 'FlowMind — AI Agent Workflow Builder',
    description: 'Chain AI agent steps with real-time monitoring.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%234f46e5'/><text x='50%' y='55%' text-anchor='middle' dominant-baseline='middle' font-size='20' fill='white'>⚡</text></svg>" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
