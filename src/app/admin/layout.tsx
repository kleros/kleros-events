import type { Metadata } from "next";
import { currentUser } from "@/lib/supabase/server";
import AdminNav from "@/components/admin/AdminNav";

// the template keeps " · Kleros Events" on every team page
export const metadata: Metadata = { title: { default: "Team desk", template: "%s · Kleros Events" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await currentUser();
  const isAdmin = !!profile?.is_admin;
  const isTeam = isAdmin || !!profile?.is_team;
  return (
    <>
      {isTeam && <AdminNav isAdmin={isAdmin} />}
      {children}
    </>
  );
}
