import "./globals.css";

export const metadata = {
  title: "LLM Playground | Mini OpenAI Playground",
  description: "Interactive LLM Playground with sampling parameters, streaming, JSON mode, and telemetry dashboard.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-zinc-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
