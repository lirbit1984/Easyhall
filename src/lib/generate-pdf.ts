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
export async function elementToPdfBlob(element: HTMLElement): Promise<Blob> {
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
  const dataUrl = canvas.toDataURL("image/png");

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [width, height],
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
  return pdf.output("blob");
}
