import { PageHeader } from "@/components/layout/page-header";
import { BlueprintBox } from "@/components/layout/blueprint-box";

/**
 * מסך שדרוג מנוי — placeholder בסיסי. עדיין אין ספק סליקה מחובר למנוי
 * העצמי של EasyHall (בשונה מ-Grow שמשמש לתשלומי הלקוחות של האולם).
 */
export default function UpgradePage() {
  return (
    <div className="p-3 sm:p-6">
      <PageHeader title="שדרוג מנוי" subtitle="המשיכו להשתמש ב-EasyHall ללא הפרעה" />
      <BlueprintBox className="mx-auto w-full max-w-md p-6 text-center">
        <p className="text-sm text-muted-foreground">
          חיבור סליקה למנוי העצמי עדיין לא הופעל. לשדרוג ידני, צרו קשר עם התמיכה.
        </p>
      </BlueprintBox>
    </div>
  );
}
