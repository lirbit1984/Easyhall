import { AppShell } from "@/components/layout/app-shell";
import { AuthGuard } from "@/components/auth/auth-guard";
import { FirestoreSync } from "@/lib/firebase/firestore-sync";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <FirestoreSync />
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
