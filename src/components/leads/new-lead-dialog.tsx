"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
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
import { coupleDisplayName } from "@/lib/format";
import { PARTNER_GENDER_LABELS as GENDER_LABELS, type PartnerGender } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NewLeadFormValues {
  partner_1_name: string;
  partner_2_name: string;
  partner_1_gender: "bride" | "groom" | "unspecified";
  partner_2_gender: "bride" | "groom" | "unspecified";
  phone_primary: string;
  email?: string;
  lead_source: string;
  assigned_user_id: string;
  estimated_guests?: number;
  price_per_plate?: number;
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
  const { members } = useOrgMembers();
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const { register, handleSubmit, reset, setValue, watch } = useForm<NewLeadFormValues>({
    defaultValues: {
      lead_source: LEAD_SOURCES[0],
      assigned_user_id: currentUserId,
      partner_1_gender: "unspecified",
      partner_2_gender: "unspecified",
    },
  });

  // defaultValues above are captured once at mount, before the real session
  // (currentUserId) may be resolved — re-sync the field each time the dialog opens.
  useEffect(() => {
    if (open) {
      setValue("assigned_user_id", currentUserId);
      setMoreOpen(false);
    }
  }, [open, currentUserId, setValue]);

  const partner1 = watch("partner_1_name");
  const partner2 = watch("partner_2_name");
  const previewName = [partner1, partner2].filter(Boolean).join(" & ") || "ליד חדש";
  const previewInitial = (partner1 || partner2 || "ל")[0];

  const onSubmit = (values: NewLeadFormValues) => {
    const lead = addLead({
      ...values,
      estimated_guests: Number(values.estimated_guests) || 0,
      price_per_plate: Number(values.price_per_plate) || 0,
    });
    toast.success(`הליד "${coupleDisplayName(lead)}" נוצר בהצלחה`, {
      action: {
        label: "פתח כרטיס",
        onClick: () => setCreatedLeadId(lead.lead_id),
      },
    });
    reset();
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

        {/* כותרת חיה — מציגה את שם הזוג תוך כתיבה */}
        <div className="mb-1 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] font-semibold text-accent-foreground">
            {previewInitial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{previewName}</p>
            <p className="text-xs text-muted-foreground">ליד חדש</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="partner_1_name">שם בן/בת זוג 1</Label>
              <Input id="partner_1_name" required {...register("partner_1_name")} />
              <Select
                value={watch("partner_1_gender")}
                onValueChange={(v) => v && setValue("partner_1_gender", v as "bride" | "groom" | "unspecified")}
              >
                <SelectTrigger size="sm">
                  <SelectValue>{(v: string) => GENDER_LABELS[v as PartnerGender]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(GENDER_LABELS) as Array<keyof typeof GENDER_LABELS>).map((g) => (
                    <SelectItem key={g} value={g}>
                      {GENDER_LABELS[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="partner_2_name">שם בן/בת זוג 2</Label>
              <Input id="partner_2_name" required {...register("partner_2_name")} />
              <Select
                value={watch("partner_2_gender")}
                onValueChange={(v) => v && setValue("partner_2_gender", v as "bride" | "groom" | "unspecified")}
              >
                <SelectTrigger size="sm">
                  <SelectValue>{(v: string) => GENDER_LABELS[v as PartnerGender]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(GENDER_LABELS) as Array<keyof typeof GENDER_LABELS>).map((g) => (
                    <SelectItem key={g} value={g}>
                      {GENDER_LABELS[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="phone_primary">טלפון</Label>
              <Input id="phone_primary" required dir="ltr" {...register("phone_primary")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">אימייל</Label>
              <Input id="email" type="email" dir="ltr" {...register("email")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>מקור ליד</Label>
              <Select
                value={watch("lead_source")}
                onValueChange={(v) => v && setValue("lead_source", v)}
              >
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
              <Select
                value={watch("assigned_user_id")}
                onValueChange={(v) => v && setValue("assigned_user_id", v)}
              >
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
                  <Input id="estimated_guests" type="number" {...register("estimated_guests")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="price_per_plate">מחיר מנה (₪)</Label>
                  <Input id="price_per_plate" type="number" {...register("price_per_plate")} />
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
