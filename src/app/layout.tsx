import type { Metadata } from "next";
import { Heebo, Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { OrgProvider } from "@/lib/firebase/org-context";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
    <html
      dir="rtl"
      lang="he"
      className={`${heebo.variable} ${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
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
