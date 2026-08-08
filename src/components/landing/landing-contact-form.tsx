"use client";

import { useState } from "react";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { functions, isFirebaseConfigured } from "@/lib/firebase/client";

/** טלפון ישראלי — אותה בדיקה שרצה גם בשרת ב-submitSiteLead. */
const IL_PHONE = /^(?:\+?972|0)(?:[23489]|5\d|7\d)-?\d{7}$/;

/**
 * טופס יצירת הקשר של דף הנחיתה. שולח ל-Cloud Function submitSiteLead שכותבת
 * את הפנייה ל-siteLeads ושולחת התרעת מייל. עד היום הטופס רק הציג "תודה"
 * בלי לשלוח כלום — כל פנייה מהאתר אבדה.
 */
export function LandingContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState(""); // honeypot — מוסתר מבני אדם
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (!email.trim() && !phone.trim())) {
      toast.error("נא למלא שם ולפחות אימייל או טלפון");
      return;
    }
    if (phone.trim() && !IL_PHONE.test(phone.replace(/[\s()-]/g, ""))) {
      toast.error("מספר הטלפון לא תקין — לדוגמה 050-1234567");
      return;
    }

    if (!isFirebaseConfigured || !functions) {
      toast.error("שליחת הטופס אינה זמינה כרגע. אפשר להתקשר אלינו ישירות.");
      return;
    }

    setSending(true);
    try {
      const submitSiteLead = httpsCallable(functions, "submitSiteLead");
      await submitSiteLead({ name: name.trim(), email: email.trim(), phone: phone.trim(), company });
      setSent(true);
      toast.success("תודה! נחזור אליכם בהקדם עם הדגמה מותאמת.");
      setName("");
      setEmail("");
      setPhone("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שליחת הפנייה נכשלה — נסו שוב.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <p className="py-8 text-center text-[15px] text-accent-foreground">
        הפרטים התקבלו — ניצור איתכם קשר בקרוב. תודה!
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <div className="grid gap-1.5">
        <Label htmlFor="lc_name">שם</Label>
        <Input id="lc_name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="lc_email">אימייל</Label>
        <Input
          id="lc_email"
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="lc_phone">טלפון</Label>
        <Input
          id="lc_phone"
          type="tel"
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      {/* מלכודת בוטים: מוסתרת מהעין ומקוראי מסך, בוטים ממלאים אותה בכל זאת. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="pointer-events-none absolute -left-[9999px] size-0 opacity-0"
      />
      <Button type="submit" disabled={sending} className="mt-1 w-full">
        {sending ? "שולח..." : "שליחה"}
      </Button>
    </form>
  );
}
