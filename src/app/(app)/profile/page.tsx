import { Suspense } from "react";
import { ProfileView } from "@/components/profile/profile-view";

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileView />
    </Suspense>
  );
}
