import { AdminDashboard } from "@/components/AdminDashboard";

export const metadata = {
  title: "Admin — ENGINEERED",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminDashboard />;
}
