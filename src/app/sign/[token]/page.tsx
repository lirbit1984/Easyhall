"use client";

import { use, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, FileWarning, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSignRequest, submitSignature, type SignRequestDoc } from "@/lib/sign-request";

/**
 * עמוד חתימה ציבורי לזוג (/sign/{token}) — נפתח מהקישור בוואטסאפ בלי התחברות.
 * קוראים את החוזה, ממלאים שם ות.ז, חותמים באצבע ומאשרים.
 */
const nis = (n: number) => "₪" + n.toLocaleString("he-IL", { maximumFractionDigits: 2 });
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("he-IL") : "");

export default function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [req, setReq] = useState<SignRequestDoc | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [agree, setAgree] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getSignRequest(token).then((r) => !cancelled && setReq(r)).catch(() => !cancelled && setReq(null));
    return () => { cancelled = true; };
  }, [token]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = point(e);
    ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.strokeStyle = "#111";
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    drawing.current = true;
    canvasRef.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = point(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    setHasInk(true);
  };
  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  const submit = async () => {
    if (!name.trim() || !idNumber.trim()) return setError("יש למלא שם מלא ותעודת זהות");
    if (!hasInk) return setError("יש לחתום במסגרת");
    if (!agree) return setError("יש לאשר שקראתם את החוזה");
    setError(""); setSending(true);
    try {
      await submitSignature(token, { name: name.trim(), id_number: idNumber.trim(), signature: canvasRef.current!.toDataURL("image/png") });
      setReq(await getSignRequest(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : "החתימה לא נשלחה, נסו שוב");
    } finally {
      setSending(false);
    }
  };

  if (req === undefined) {
    return <main className="flex flex-1 items-center justify-center p-6"><Loader2 className="size-8 animate-spin text-muted-foreground" /></main>;
  }
  if (req === null) {
    return (
      <main className="flex flex-1 items-center justify-center p-6 text-center">
        <div className="grid justify-items-center gap-2">
          <FileWarning className="size-8 text-muted-foreground" />
          <h1 className="text-lg">הקישור לא נמצא</h1>
          <p className="max-w-xs text-sm text-muted-foreground">ייתכן שהקישור שגוי. אפשר לבקש קישור חדש מהאולם.</p>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="mx-auto grid w-full max-w-md gap-4 p-4">
      <header className="grid justify-items-center gap-1 text-center">
        {req.logoUrl && <img src={req.logoUrl} alt="" className="h-14 object-contain" />}
        <h1 className="text-xl font-bold">{req.orgName}</h1>
        <p className="text-sm text-muted-foreground">חוזה התקשרות · {req.title}</p>
      </header>

      <section className="grid gap-1 rounded-lg border border-border p-3 text-sm">
        {req.eventDate && <div>תאריך האירוע: <b>{fmtDate(req.eventDate)}</b></div>}
        {req.guests > 0 && <div>כמות אורחים: <b>{req.guests}</b></div>}
        <div>סה״כ: <b>{nis(req.total)}</b></div>
        {req.pdfUrl && req.pdfUrl !== "#" && (
          <a href={req.pdfUrl} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1.5 text-primary underline">
            <FileText className="size-4" />לקריאת החוזה המלא (PDF)
          </a>
        )}
      </section>

      {req.status === "signed" && req.signed ? (
        <section className="grid justify-items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-center text-sm text-emerald-900">
          <CheckCircle2 className="size-8" />
          <b>החוזה נחתם, תודה!</b>
          <div>{req.signed.name} · {new Date(req.signed.signed_at).toLocaleString("he-IL")}</div>
          <img src={req.signed.signature} alt="חתימה" className="h-20 rounded bg-white" />
        </section>
      ) : (
        <section className="grid gap-3 text-sm">
          <label className="grid gap-1">שם מלא<Input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="grid gap-1">תעודת זהות<Input inputMode="numeric" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} /></label>
          <div className="grid gap-1">
            <div className="flex items-center justify-between">
              חתמו כאן באצבע
              <button type="button" className="text-xs text-muted-foreground underline" onClick={clear}>נקה</button>
            </div>
            <canvas ref={canvasRef} width={600} height={220}
              className="h-36 w-full touch-none rounded-lg border-2 border-dashed border-border bg-white"
              onPointerDown={down} onPointerMove={move} onPointerUp={() => (drawing.current = false)} onPointerLeave={() => (drawing.current = false)} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            קראתי את החוזה ואני מאשר/ת את תנאיו
          </label>
          {error && <div className="text-destructive">{error}</div>}
          <Button size="lg" onClick={submit} disabled={sending}>
            {sending && <Loader2 className="size-4 animate-spin" />}אישור וחתימה
          </Button>
        </section>
      )}
    </main>
  );
}
