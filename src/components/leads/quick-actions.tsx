"use client";

import { useState } from "react";
import { Phone, MessageSquarePlus } from "lucide-react";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { waLink, telLink } from "@/lib/format";
import { useLeadsStore } from "@/store/use-leads-store";

export function QuickActions({
  leadId,
  phone,
  partnerName,
  size = "sm",
}: {
  leadId: string;
  phone: string;
  partnerName: string;
  size?: "sm" | "default";
}) {
  const addActivity = useLeadsStore((s) => s.addActivity);
  const addSystemActivity = useLeadsStore((s) => s.addSystemActivity);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const iconSize = size === "sm" ? "size-3.5" : "size-4";
  const btnSize = size === "sm" ? "size-7" : "size-8";

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    addSystemActivity(leadId, "whatsapp", `נשלחה הודעת WhatsApp ל${partnerName}.`);
    window.open(waLink(phone, `שלום ${partnerName}, `), "_blank", "noopener,noreferrer");
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    addSystemActivity(leadId, "outgoing_call", `בוצעה שיחה יוצאת ל${partnerName}.`);
    window.location.href = telLink(phone);
  };

  const submitNote = () => {
    if (!note.trim()) return;
    addActivity(leadId, "note", note.trim());
    toast.success("ההערה נוספה לפיד התקשורת");
    setNote("");
    setNoteOpen(false);
  };

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="outline"
        size="icon"
        className={btnSize}
        title="שלח WhatsApp"
        onClick={handleWhatsApp}
      >
        <WhatsappIcon className={`${iconSize} text-green-600`} />
      </Button>
      <Button variant="outline" size="icon" className={btnSize} title="חייג" onClick={handleCall}>
        <Phone className={`${iconSize} text-blue-600`} />
      </Button>
      <Popover open={noteOpen} onOpenChange={setNoteOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className={btnSize}
              title="הוסף הערה מהירה"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            />
          }
        >
          <MessageSquarePlus className={iconSize} />
        </PopoverTrigger>
        <PopoverContent className="w-72" onClick={(e) => e.stopPropagation()}>
          <div className="grid gap-2">
            <Textarea
              placeholder="הוסף הערה מהירה..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              autoFocus
            />
            <Button size="sm" onClick={submitNote}>
              שמור הערה
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
