import type { Metadata } from "next";
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
    <html lang="en" className="h-full antialiased">
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
