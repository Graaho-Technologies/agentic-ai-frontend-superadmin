import type { Metadata } from "next";
import "./globals.css";
import { poppins } from "./fonts";
// Importing AWS Amplify configuration
import { Amplify } from 'aws-amplify';
import  amplifyConfig  from "@/aws-exports"
import { ReduxProvider } from './providers/providers';
import { AmplifyProvider } from './providers/amplify-provider';

Amplify.configure(amplifyConfig);




export const metadata: Metadata = {
  title: "Graaho AI · Super Admin",
  description: "Super Admin Control Panel — Graaho AI Agent Platform",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={poppins.className}
      >
         <ReduxProvider>
        <AmplifyProvider>
          {children}
        </AmplifyProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
