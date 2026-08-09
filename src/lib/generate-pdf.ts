import { toSvg } from "html-to-image";
import jsPDF from "jspdf";

/**
 * Renders a DOM element (the on-screen document preview) to a PDF blob.
 * Captured as an image rather than built with jsPDF's text API — jsPDF has no
 * reliable RTL/Hebrew shaping, so rasterizing the already-correct HTML preview
 * is the only way to get a visually faithful Hebrew document. Uses
 * html-to-image's `toSvg` (SVG foreignObject + the browser's own rendering)
 * rather than html2canvas, which cannot parse the modern oklch()/lab() color
 * functions this project's Tailwind v4 theme uses throughout.
 *
 * We rasterize the SVG to a canvas ourselves instead of calling html-to-image's
 * own toPng/toCanvas: its internal createImage() sets img.crossOrigin and
 * awaits img.decode(), and that decode() promise never resolves in this
 * environment — the image paints fine but decode() hangs forever with no
 * error. Loading via plain img.onload (no crossOrigin, no decode()) avoids it.
 */
/** רסטור של אלמנט DOM לתמונת PNG — שלב המשותף בין מסמך עמוד-בודד לרב-עמודי. */
export async function elementToPngDataUrl(
  element: HTMLElement
): Promise<{ dataUrl: string; width: number; height: number }> {
  const width = element.offsetWidth;
  const height = element.offsetHeight;

  const svgDataUrl = await toSvg(element, {
    backgroundColor: "#ffffff",
    width,
    height,
    // See note above on the web-font embedding path: it walks every stylesheet
    // on the page and does an unbounded fetch() for any it can't read
    // cssRules from directly (e.g. dev-server-injected style tags), hanging
    // forever if one never settles. The already-loaded Heebo font still
    // renders correctly since rasterization happens in the same document.
    skipFonts: true,
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("נכשלה טעינת התצוגה המקדימה לצורך הפקת PDF"));
    img.src = svgDataUrl;
  });

  const ratio = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

/**
 * מפיק PDF בגודל עמוד A4 סטנדרטי (לא בגודל-פיקסלים-מדויק של האלמנט) — קובץ
 * שגודל העמוד שלו הוא בדיוק גובה/רוחב התוכן נראה תקין על המסך, אבל כשמדפיסים
 * אותו בפועל על נייר A4 רגיל, הדפדפן/מדפסת חותכים אותו ל"גודל אמיתי" במקום
 * להתאים לעמוד. אם התוכן ארוך מעמוד A4 אחד (הצעת מחיר עם הרבה שורות/תאריכים),
 * פורסים אותו למספר עמודי A4 לפי חתכי גובה, כדי שלא ייחתך תוכן.
 */
export async function elementToPdfBlob(element: HTMLElement): Promise<Blob> {
  const { dataUrl, width, height } = await elementToPngDataUrl(element);
  const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;
  const scale = usableWidth / width;
  const scaledHeight = height * scale;

  if (scaledHeight <= usableHeight) {
    pdf.addImage(dataUrl, "PNG", margin, margin, usableWidth, scaledHeight);
    return pdf.output("blob");
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("שגיאה בעיבוד המסמך לצורך פיצול לעמודים"));
    img.src = dataUrl;
  });
  const naturalRatio = image.naturalHeight / height;
  const sliceHeightLogical = usableHeight / scale;
  const sliceHeightNatural = sliceHeightLogical * naturalRatio;
  const totalSlices = Math.ceil(height / sliceHeightLogical);

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  const ctx = canvas.getContext("2d")!;

  for (let i = 0; i < totalSlices; i++) {
    const sy = i * sliceHeightNatural;
    const thisSliceNaturalHeight = Math.min(sliceHeightNatural, image.naturalHeight - sy);
    canvas.height = Math.ceil(thisSliceNaturalHeight);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      image,
      0,
      sy,
      image.naturalWidth,
      thisSliceNaturalHeight,
      0,
      0,
      canvas.width,
      thisSliceNaturalHeight
    );
    const sliceScaledHeight = (thisSliceNaturalHeight / naturalRatio) * scale;
    if (i > 0) pdf.addPage("a4", "portrait");
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, usableWidth, sliceScaledHeight);
  }
  return pdf.output("blob");
}

/**
 * PDF רב-עמודי: כל עמוד מגיע מרסטור נפרד של אותו אלמנט DOM (למשל: לוח שנה
 * שמוחלף חודש-חודש), כדי שכל עמוד יקבל את המידות/היחס שלו במקום להימתח
 * לגודל העמוד הראשון.
 */
export async function elementsToPdfBlob(elements: HTMLElement[]): Promise<Blob> {
  if (elements.length === 0) throw new Error("אין תוכן להפקת PDF");
  let pdf: jsPDF | null = null;
  for (const element of elements) {
    const { dataUrl, width, height } = await elementToPngDataUrl(element);
    if (!pdf) {
      pdf = new jsPDF({ orientation: width >= height ? "landscape" : "portrait", unit: "px", format: [width, height] });
    } else {
      pdf.addPage([width, height], width >= height ? "landscape" : "portrait");
    }
    pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
  }
  return pdf!.output("blob");
}
