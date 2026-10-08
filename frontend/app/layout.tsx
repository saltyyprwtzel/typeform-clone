import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Formcraft — forms that feel human",
  description: "Build conversational forms and collect thoughtful responses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="fall" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("formcraft-theme");var allowed=["light","dark","spring","summer","fall","winter"];document.documentElement.setAttribute("data-theme",allowed.indexOf(t)>-1?t:"fall")}catch(e){document.documentElement.setAttribute("data-theme","fall")}})()` }} /></head><body>{children}</body></html>;
}
