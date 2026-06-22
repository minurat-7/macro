import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "1일 1비문학 챌린지",
  description: "매일 한 지문 비문학 풀이와 분석 기록 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <NavBar />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
