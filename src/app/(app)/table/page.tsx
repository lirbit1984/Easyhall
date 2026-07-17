import { redirect } from "next/navigation";

// הטבלה מוזגה לתוך הדשבורד כתצוגה (מתג קנבאן/טבלה). הנתיב הישן נשמר
// כהפניה כדי שסימניות/קישורים ישנים ל-/table לא ישברו.
export default function TablePage() {
  redirect("/kanban");
}
