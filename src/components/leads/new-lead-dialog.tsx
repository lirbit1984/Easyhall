"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LeadDrawer } from "@/components/leads/lead-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeadsStore } from "@/store/use-leads-store";
import { LEAD_SOURCES } from "@/lib/mock-data";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { getEventTitle } from "@/lib/format";
import { EVENT_CONTACT_ROLE_LABELS, type EventContactRoleKey } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ContactRow {
  role_key: EventContactRoleKey;
  name: string;
  phone: string;
}

export function NewLeadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addLead = useLeadsStore((s) => s.addLead);
  const currentUserId = useLeadsStore((s) => s.currentUserId);
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const { members } = useOrgMembers();
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const [eventTypeId, setEventTypeId] = useState("");
  const [contactRows, setContactRows] = useState<ContactRow[]>([]);
  const [phonePrimary, setPhonePrimary] = useState("");
  const [email, setEmail] = useState("");
  const [leadSource, setLeadSource] = useState(LEAD_SOURCES[0]);
  const [assignedUserId, setAssignedUserId] = useState(currentUserId);
  const [estimatedGuests, setEstimatedGuests] = useState("");
  const [pricePerPlate, setPricePerPlate] = useState("");

  const selectedType = eventTypes.find((t) => t.event_type_id === eventTypeId);
  const availableRoles = selectedType?.role_keys ?? [];

  const resetForRoles = (roleKeys: EventContactRoleKey[]) => {
    setContactRows([
      { role_key: roleKeys[0] ?? "guest", name: "", phone: "" },
      { role_key: roleKeys[1] ?? roleKeys[0] ?? "guest", name: "", phone: "" },
    ]);
  };

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets a form's local state on open, not derived from render
      setMoreOpen(false);
      setAssignedUserId(currentUserId);
      setEmail("");
      setLeadSource(LEAD_SOURCES[0]);
      setEstimatedGuests("");
      setPricePerPlate("");
      const firstType = eventTypes[0];
      setEventTypeId(firstType?.event_type_id ?? "");
      resetForRoles(firstType?.role_keys ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentUserId]);

  const handleSelectEventType = (typeId: string) => {
    setEventTypeId(typeId);
    const type = eventTypes.find((t) => t.event_type_id === typeId);
    resetForRoles(type?.role_keys ?? []);
  };

  const updateRow = (index: number, updates: Partial<ContactRow>) => {
    setContactRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  };

  const addRow = () => {
    setContactRows((rows) => [
      ...rows,
      { role_key: availableRoles[0] ?? "guest", name: "", phone: "" },
    ]);
  };

  const removeRow = (index: number) => {
    setContactRows((rows) => rows.filter((_, i) => i !== index));
  };

  const previewName = getEventTitle({
    contacts: contactRows
      .filter((r) => r.name.trim())
      .map((r, i) => ({ contact_id: `preview${i}`, role_key: r.role_key, name: r.name.trim() })),
  }, selectedType);
  const previewInitial = (contactRows.find((r) => r.name.trim())?.name || "ל")[0];

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const filledContacts = contactRows.filter((r) => r.name.trim());
    if (!eventTypeId) {
      toast.error("יש לבחור סוג אירוע");
      return;
    }
    if (filledContacts.length === 0) {
      toast.error("יש להזין לפחות איש קשר אחד");
      return;
    }
    if (!phonePrimary.trim()) {
      toast.error("יש להזין טלפון");
      return;
    }

    const lead = addLead({
      event_type_id: eventTypeId,
      contacts: filledContacts.map((r) => ({
        role_key: r.role_key,
        name: r.name.trim(),
        phone: r.phone.trim() || undefined,
      })),
      email: email || undefined,
      lead_source: leadSource,
      assigned_user_id: assignedUserId,
      estimated_guests: Number(estimatedGuests) || 0,
      price_per_plate: Number(pricePerPlate) || 0,
    });
    // הבטחת טלפון ראשי — נשמר על איש הקשר הראשון אם לא הוזן ידנית עבורו
    if (!filledContacts[0].phone?.trim() && phonePrimary.trim()) {
      lead.contacts[0].phone = phonePrimary.trim();
    }

    toast.success(`הליד "${getEventTitle(lead, selectedType)}" נוצר בהצלחה`, {
      action: {
        label: "פתח כרטיס",
        onClick: () => setCreatedLeadId(lead.lead_id),
      },
    });
    setMoreOpen(false);
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>ליד חדש</DialogTitle>
        </DialogHeader>

        {/* כותרת חיה — מציגה את שם האירוע תוך כתיבה */}
        <div className="mb-1 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] font-semibold text-accent-foreground">
            {previewInitial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{previewName}</p>
            <p className="text-xs text-muted-foreground">ליד חדש</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>סוג אירוע</Label>
            <Select value={eventTypeId} onValueChange={(v) => v && handleSelectEventType(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) => eventTypes.find((t) => t.event_type_id === v)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((t) => (
                  <SelectItem key={t.event_type_id} value={t.event_type_id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            {contactRows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-1.5">
                <Input
                  placeholder="שם"
                  required={i < 2}
                  value={row.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                />
                <Input
                  placeholder="טלפון"
                  dir="ltr"
                  value={row.phone}
                  onChange={(e) => updateRow(i, { phone: e.target.value })}
                />
                <Select
                  value={row.role_key}
                  onValueChange={(v) => v && updateRow(i, { role_key: v as EventContactRoleKey })}
                >
                  <SelectTrigger size="sm" className="w-32">
                    <SelectValue>{(v: string) => EVENT_CONTACT_ROLE_LABELS[v as EventContactRoleKey]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {EVENT_CONTACT_ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {contactRows.length > 2 && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => removeRow(i)}
                    aria-label="הסר איש קשר"
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" onClick={addRow}>
              <Plus className="size-3.5" />
              הוסף איש קשר
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="phone_primary">טלפון ליצירת קשר</Label>
              <Input
                id="phone_primary"
                required
                dir="ltr"
                value={phonePrimary}
                onChange={(e) => setPhonePrimary(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">אימייל</Label>
              <Input id="email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>מקור ליד</Label>
              <Select value={leadSource} onValueChange={(v) => v && setLeadSource(v)}>
                <SelectTrigger>
                  <SelectValue>{(value: string) => value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>נציג אחראי</Label>
              <Select value={assignedUserId} onValueChange={(v) => v && setAssignedUserId(v)}>
                <SelectTrigger>
                  <SelectValue>
                    {(value: string) => members.find((u) => u.user_id === value)?.full_name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {members.filter((u) => u.role !== "office").map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* פרטים נוספים — מתקפל, כדי לצמצם עומס חזותי בטופס היצירה המהיר */}
          <div className="-mt-1 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="flex w-full items-center justify-between text-[13px] text-muted-foreground hover:text-foreground"
            >
              עוד פרטים (מוזמנים, מחיר)
              <ChevronDown className={cn("size-4 transition-transform", moreOpen && "rotate-180")} />
            </button>
            {moreOpen && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="estimated_guests">כמות מוזמנים משוערת</Label>
                  <Input
                    id="estimated_guests"
                    type="number"
                    value={estimatedGuests}
                    onChange={(e) => setEstimatedGuests(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="price_per_plate">מחיר מנה (₪)</Label>
                  <Input
                    id="price_per_plate"
                    type="number"
                    value={pricePerPlate}
                    onChange={(e) => setPricePerPlate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="-mx-4 -mb-4 flex items-center justify-between rounded-b-xl border-t bg-muted/50 p-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit">צור ליד</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <LeadDrawer leadId={createdLeadId} onOpenChange={(open) => !open && setCreatedLeadId(null)} />
    </>
  );
}
