import { LogoutButton } from "./logout-button";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-warm-200">
        <h2 className="text-xl font-serif font-bold">Admin Dashboard</h2>
        <LogoutButton />
      </div>
      {children}
    </div>
  );
}
