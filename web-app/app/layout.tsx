import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  AppearanceProvider,
  ChatProvider,
  ConfigProvider,
  LayoutWrapper,
  SessionProvider,
  UserStoreProvider,
  WindowProvider,
} from "@/components";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyUni | Student Portal",
  description: "A modern, AI-powered internal university portal for students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Providers are ordered from core identity state to UI-specific shells. */}
        <UserStoreProvider>
          <SessionProvider>
            <AppearanceProvider>
              <ConfigProvider>
                <WindowProvider>
                  <ChatProvider>
                    <LayoutWrapper>
                      {children}
                    </LayoutWrapper>
                  </ChatProvider>
                </WindowProvider>
              </ConfigProvider>
            </AppearanceProvider>
          </SessionProvider>
        </UserStoreProvider>
      </body>
    </html>
  );
}
