import { Camera, ThumbsUp, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";

const INTEGRATIONS = [
  {
    key: "instagram",
    name: "אינסטגרם",
    description: "קליטת לידים מהודעות ותגובות + מענה ישיר מתוך EasyHall.",
    icon: Camera,
  },
  {
    key: "facebook",
    name: "פייסבוק",
    description: "קליטת לידים מטפסי Lead Ads ומהודעות עמוד + מענה ישיר.",
    icon: ThumbsUp,
  },
  {
    key: "google",
    name: "גוגל",
    description: "קליטת פניות מטופסי גוגל / Google Business Profile.",
    icon: Search,
  },
  {
    key: "whatsapp",
    name: "וואטסאפ עסקי",
    description: "קליטת לידים משיחות נכנסות + ניהול שיחה מתוך כרטיס הליד.",
    icon: WhatsappIcon,
  },
] as const;

/**
 * שריון מבני בלבד — כל חיבור דורש חשבון עסקי מאושר בפלטפורמה עצמה
 * (Meta Business / WhatsApp Business API / Google) ותהליך OAuth נפרד;
 * הבנייה בפועל של כל חיבור היא משימה עצמאית בהמשך.
 */
export function IntegrationsSettings() {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-3">
      <p className="text-sm text-muted-foreground">
        חיבור ישיר לפלטפורמות שמהן מגיעים לידים — קליטה אוטומטית לתוך המערכת ומענה ישיר בלי לצאת מ-EasyHall.
        כל חיבור דורש אישור מול הפלטפורמה עצמה ויתווסף בנפרד.
      </p>
      {INTEGRATIONS.map(({ key, name, description, icon: Icon }) => (
        <BlueprintBox key={key} className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">{name}</h3>
              <Badge variant="secondary" className="rounded-full text-[12px]">בקרוב</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </BlueprintBox>
      ))}
    </div>
  );
}
