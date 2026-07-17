import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { OrgProvider } from "@/lib/firebase/org-context";

/**
 * Ploni — פונט המערכת (עברית + לטינית), משמש גם לכותרות וגם לגוף הטקסט.
 * המשקלים נלקחו מה-usWeightClass של הקבצים עצמם; שימו לב ש-DBold הוא
 * Demi Bold (600) ולא 800, ולכן `font-semibold` מקבל את הפייס הנכון.
 */
const ploni = localFont({
  variable: "--font-ploni",
  display: "swap",
  src: [
    { path: "../../public/fonts/PloniLight.woff2", weight: "300", style: "normal" },
    { path: "../../public/fonts/PloniRegular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/PloniMedium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/PloniDBold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/PloniBold.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/PloniBlack.woff2", weight: "900", style: "normal" },
  ],
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
    <html dir="rtl" lang="he" className={`${ploni.variable} h-full antialiased`}>
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
