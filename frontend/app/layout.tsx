import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Formcraft — forms that feel human",
  description: "Build conversational forms and collect thoughtful responses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
