"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * טופס יצירת הקשר של דף הנחיתה. אין עדיין endpoint לקליטת לידים מהאתר, אז
 * הטופס מאמת קלט ומציג אישור — נקודת החיבור לשרת תתווסף כשנחליט על היעד.
 */
export function LandingContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (!email.trim() && !phone.trim())) {
      toast.error("נא למלא שם ולפחות אימייל או טלפון");
      return;
    }
    // TODO: לחבר ל-endpoint לקליטת לידים מהאתר כשייקבע היעד.
    setSent(true);
    toast.success("תודה! נחזור אליכם בהקדם עם הדגמה מותאמת.");
    setName("");
    setEmail("");
    setPhone("");
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
      <Button type="submit" className="mt-1 w-full">
        שליחה
      </Button>
    </form>
  );
}
