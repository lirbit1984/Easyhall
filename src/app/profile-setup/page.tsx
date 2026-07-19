"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { doc, setDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { db, storage, isFirebaseConfigured } from "@/lib/firebase/client";
import { useOrg } from "@/lib/firebase/org-context";
import { FirebaseNotConfigured } from "@/components/auth/firebase-not-configured";

export default function ProfileSetupPage() {
  if (!isFirebaseConfigured) {
    return <FirebaseNotConfigured />;
  }
  return <ProfileSetupForm />;
}

function ProfileSetupForm() {
  const router = useRouter();
  const { user, profile, memberships, loading: orgLoading, refreshProfile } = useOrg();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (orgLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (!user.emailVerified) {
      router.replace("/verify-email");
    } else if (profile) {
      // כבר יש פרופיל (למשל חלון קודם/רענון) — אין מה לעשות כאן שוב.
      // משתמש שכבר שייך לארגון (למשל חשבון ותיק שרק השלים פרופיל בדיעבד)
      // ממשיך ישר לאפליקציה במקום לעבור שוב דרך יצירת/הצטרפות לאולם.
      router.replace(memberships.length > 0 ? "/kanban" : "/onboarding");
    }
  }, [user, profile, orgLoading, router]);

  const [firstName, setFirstName] = useState(user?.displayName?.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(
    user?.displayName?.split(" ").slice(1).join(" ") ?? ""
  );
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(user?.photoURL ?? null);
  const [saving, setSaving] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("שם פרטי ושם משפחה הם שדות חובה");
      return;
    }

    setSaving(true);
    try {
      let photoURL = user.photoURL ?? undefined;
      if (photoFile && storage) {
        const path = `users/${user.uid}/profile/${Date.now()}-${photoFile.name}`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, photoFile, { contentType: photoFile.type });
        photoURL = await getDownloadURL(fileRef);
      }

      await setDoc(doc(db, "users", user.uid), {
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        ...(phone.trim() && { phone: phone.trim() }),
        ...(jobTitle.trim() && { jobTitle: jobTitle.trim() }),
        ...(photoURL && { photoURL }),
      });

      await refreshProfile();
      toast.success("הפרופיל נשמר");
      router.push(memberships.length > 0 ? "/kanban" : "/onboarding");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשמירת הפרופיל");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4" dir="rtl">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 text-center">
          <h1 className="text-lg font-semibold">בואו נכיר</h1>
          <p className="text-sm text-muted-foreground">
            כמה פרטים בסיסיים כדי שנוכל לפנות אליך בשם ולתייג אותך נכון בתיעוד
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="mb-1 flex justify-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative"
              aria-label="העלאת תמונת פרופיל"
            >
              <Avatar size="lg" className="size-16">
                {photoPreview && <AvatarImage src={photoPreview} alt="" />}
                <AvatarFallback className="text-base">
                  {firstName.trim() ? firstName.trim()[0] : <Camera className="size-5" />}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-1 -left-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                <Camera className="size-3.5" />
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="first_name">שם פרטי *</Label>
              <Input
                id="first_name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="last_name">שם משפחה *</Label>
              <Input
                id="last_name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">טלפון</Label>
            <Input
              id="phone"
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="050-0000000"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="job_title">תפקיד</Label>
            <Input
              id="job_title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="לדוגמה: בעל האולם, מנהלת מכירות"
            />
          </div>
          <Button type="submit" disabled={saving} className="mt-1">
            {saving ? "שומר..." : "המשך"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
