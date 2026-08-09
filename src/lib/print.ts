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

  const styleLinks = Array.from(document.styleSheets)
    .map((s) => s.href)
    .filter((href): href is string => !!href)
    .map((href) => `<link rel="stylesheet" href="${href}">`)
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
    `<html dir="rtl" lang="he"><head><title>${title}</title>${styleLinks}<style>${printStyles}</style></head><body dir="rtl">${element.outerHTML}</body></html>`
  );
  doc.close();

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) return cleanup();
    win.focus();
    win.print();
    win.onafterprint = cleanup;
    // גיבוי — לא כל דפדפן יורה onafterprint (למשל אחרי ביטול ההדפסה).
    setTimeout(cleanup, 5000);
  };
}
