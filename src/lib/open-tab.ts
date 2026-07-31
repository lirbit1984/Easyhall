/**
 * פתיחת כרטיסייה חיצונית כשצריך לחשב את הכתובת אחרי await (למשל יצירת קישור
 * קצר). חוסם החלונות הקופצים מרשה window.open רק בתוך אירוע המשתמש עצמו, ולכן
 * פותחים כרטיסייה ריקה מיד בקליק ומנווטים אותה כשהכתובת מוכנה.
 *
 * שימו לב לא להעביר "noopener" ל-window.open כאן: הדגל הזה גורם לדפדפן להחזיר
 * null במקום ידית לחלון, ואז אין למי לומר לאן לנווט והכרטיסייה נתקעת על
 * about:blank. במקום זה מנתקים את window.opener ידנית — אותה הגנה, בלי לאבד
 * את הידית.
 */
export function openBlankTab(): Window | null {
  const win = window.open("", "_blank");
  if (win) win.opener = null;
  return win;
}

/** מנווט כרטיסייה שנפתחה ב-openBlankTab; נופל ל-window.open אם היא נחסמה. */
export function navigateTab(win: Window | null, url: string): void {
  if (win && !win.closed) win.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
}
