import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";

export function FirebaseNotConfigured() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4" dir="rtl">
      <Card className="w-full max-w-sm p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 size-8 text-amber-500" />
        <h1 className="mb-1 text-lg font-semibold">החיבור ל-Firebase עדיין לא הוגדר</h1>
        <p className="text-sm text-muted-foreground">
          יש להוסיף את פרטי הקונפיגורציה של פרויקט ה-Firebase (מתוך הגדרות הפרויקט → Web App) לקובץ{" "}
          <code dir="ltr">.env.local</code>. עד אז אפשר להמשיך לעבוד עם נתוני ה-Demo תחת /kanban.
        </p>
      </Card>
    </div>
  );
}
