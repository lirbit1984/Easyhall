import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { OrgProvider } from "@/lib/firebase/org-context";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "EasyHall CRM | ניהול מכירות ולידים",
  description: "מערכת Mini-CRM לניהול מכירות ולידים לאולם אירועים",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html dir="rtl" lang="he" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-muted">
        <TooltipProvider>
          <OrgProvider>
            {children}
            <Toaster position="bottom-left" richColors />
          </OrgProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
