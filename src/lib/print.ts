/**
 * מדפיס אלמנט DOM בודד דרך iframe מוסתר בעמוד הנוכחי, במקום חלון/לשונית
 * נפרדים — window.open("", "_blank") + document.write נתקל בבעיות אמינות
 * (החלון נשאר על about:blank, popup-blockers, תזמון טעינת ה-stylesheets לפני
 * print()). ה-iframe יורש את אותו origin, כך שהעמוד נטען בוודאות לפני
 * שמפעילים הדפסה, ומוסר את עצמו מיד אחרי.
 */
export function printElement(element: HTMLElement, title: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 1000);
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }

  // משכפלים מה-<head> המקורי רק תגי עיצוב (style/link) — לא סקריפטים. שכפול
  // של ה-head כולו (כפי שהיה קודם) גרר גם את סקריפטי ה-hydration של Next.js,
  // שרצים מחדש בתוך ה-iframe ומוחקים את התוכן שכתבנו ל-body (עמוד ריק
  // בהדפסה). כולל גם <style> מוטבע (לא רק <link> חיצוני) כדי לכסות עיצוב
  // שנטען כ-style tag — בלעדיו הטבלה/השדות חוזרים לעיצוב ברירת מחדל של
  // הדפדפן, מה שגורם לחפיפה וחיתוך.
  const headHTML = Array.from(document.head.querySelectorAll("style, link[rel='stylesheet']"))
    .map((node) => node.outerHTML)
    .join("");

  // כללי הדפסה כלליים: שוליים סבירים, מניעת חיתוך שורת טבלה/בלוק באמצע בין
  // עמודים (בלי זה הדפדפן חותך שורה בדיוק על קו העמוד ומייצר טקסט חופף/קטוע),
  // וחזרת כותרת הטבלה (thead) בראש כל עמוד נוסף.
  const printStyles = `
    body{margin:0;padding:0;background:#fff;}
    @page{margin:14mm 12mm;}
    table{border-collapse:collapse;}
    thead{display:table-header-group;}
    tfoot{display:table-footer-group;}
    tr,td,th{break-inside:avoid;page-break-inside:avoid;}
    img{max-width:100%;}
  `;

  doc.open();
  doc.write(
    `<html dir="rtl" lang="he"><head><title>${title}</title>${headHTML}<style>${printStyles}</style></head><body dir="rtl">${element.outerHTML}</body></html>`
  );
  doc.close();

  let printed = false;
  const printNow = () => {
    if (printed) return;
    printed = true;
    const win = iframe.contentWindow;
    if (!win) return cleanup();
    win.focus();
    win.print();
    win.onafterprint = cleanup;
    // גיבוי — לא כל דפדפן יורה onafterprint (למשל אחרי ביטול ההדפסה).
    setTimeout(cleanup, 5000);
  };

  // מחכים שכל ה-stylesheets המקושרים (<link>) בפועל ייטענו לפני שמדפיסים —
  // iframe.onload לא תמיד מחכה לזה באופן אמין, ובלי העיצוב הטבלה/השדות
  // נראים לא מעוצבים (בדיוק החפיפה/החיתוך שהמשתמש דיווח עליהם).
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  if (links.length === 0) {
    iframe.onload = printNow;
    return;
  }
  let pending = links.length;
  const onOneLoaded = () => {
    pending -= 1;
    if (pending <= 0) printNow();
  };
  links.forEach((link) => {
    link.addEventListener("load", onOneLoaded, { once: true });
    link.addEventListener("error", onOneLoaded, { once: true });
  });
  // רשת (או שדה) איטיים לא אמורים לתקוע הדפסה לצמיתות.
  setTimeout(printNow, 3000);
}
