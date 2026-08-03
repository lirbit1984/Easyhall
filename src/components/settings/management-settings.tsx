import { PaymentSettings } from "@/components/settings/payment-settings";
import { SecuritySettings } from "@/components/settings/security-settings";
import { TeamManagement } from "@/components/team/team-management";
import { BoxKicker } from "@/components/layout/blueprint-box";

/**
 * הדברים ה"ניהוליים" שלא ניגשים אליהם יום-יום: סליקת אשראי, קודי אבטחה
 * למחיקת כרטיס, וניהול הצוות (כולל מטריצת ההרשאות לכל חבר).
 */
export function ManagementSettings() {
  return (
    <div className="grid gap-3.5">
      <PaymentSettings />
      <SecuritySettings />
      <div className="mx-auto w-full max-w-2xl">
        <BoxKicker>צוות</BoxKicker>
        <TeamManagement />
      </div>
    </div>
  );
}
