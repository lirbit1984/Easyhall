"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
    if (open) setValue("assigned_user_id", currentUserId);
  }, [open, currentUserId, setValue]);

  const onSubmit = (values: NewLeadFormValues) => {
    const lead = addLead({
      ...values,
      estimated_guests: Number(values.estimated_guests) || 0,
      price_per_plate: Number(values.price_per_plate) || 0,
    });
    toast.success(`הליד "${coupleDisplayName(lead)}" נוצר בהצלחה`);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ליד חדש</DialogTitle>
        </DialogHeader>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="estimated_guests">כמות מוזמנים משוערת</Label>
              <Input id="estimated_guests" type="number" {...register("estimated_guests")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="price_per_plate">מחיר מנה (₪)</Label>
              <Input id="price_per_plate" type="number" {...register("price_per_plate")} />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit">צור ליד</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
