import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "River Raid Remaster — Clone remasterizado do clássico",
  description:
    "Homenagem remasterizada ao clássico River Raid (1982): rio procedural, chefes, power-ups, missões, upgrades, ranking global e suporte a gamepad e toque. Projeto analisado, corrigido e melhorado a partir do código gerado por IA.",
  keywords: [
    "River Raid",
    "jogo",
    "canvas",
    "TypeScript",
    "Next.js",
    "remaster",
    "gamepad",
  ],
  authors: [{ name: "AtamisFilho" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "River Raid Remaster",
    description:
      "Clone remasterizado do clássico River Raid com gráficos modernos, chefes e ranking global.",
    siteName: "River Raid Remaster",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
