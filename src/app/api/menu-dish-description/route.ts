import { NextResponse } from "next/server";

/**
 * מנסח תיאור שיווקי קצר למנה במאגר, לפי שם וקטגוריה — קורא ל-API של Anthropic
 * מהשרת בלבד (המפתח לעולם לא מגיע ללקוח). המפתח מוגדר ב-ANTHROPIC_API_KEY.
 */
export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY לא מוגדר בשרת" }, { status: 500 });
  }

  const { name, category } = (await request.json()) as { name?: string; category?: string };
  if (!name?.trim()) {
    return NextResponse.json({ error: "שם המנה חסר" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 120,
        system:
          "אתה כותב תיאורי מנות קצרים ומפתים לתפריטי אולמות אירועים בעברית. " +
          "תמיד תחזיר משפט אחד בלבד, עד 20 מילים, בלי מרכאות ובלי הקדמות — " +
          "רק את התיאור עצמו, בטון מזמין ומכובד (לא מוגזם).",
        messages: [{ role: "user", content: `שם המנה: ${name.trim()}\nקטגוריה: ${category ?? ""}` }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: `שגיאה מול Anthropic: ${detail}` }, { status: 502 });
    }

    const data = await res.json();
    const description = data.content?.[0]?.text?.trim();
    if (!description) {
      return NextResponse.json({ error: "לא התקבל תיאור" }, { status: 502 });
    }
    return NextResponse.json({ description });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "שגיאה בקריאה ל-AI" },
      { status: 500 }
    );
  }
}
