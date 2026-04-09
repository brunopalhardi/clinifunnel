import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CliniFunnel",
  description:
    "Funil de vendas completo para clínicas: do clique ao procedimento",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="font-sans antialiased">
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
