"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { CAPABILITY } from "../../utils/permissions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { loading, hasCapability } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !hasCapability(CAPABILITY.ADMIN_ACCESS)) {
      router.push("/profile");
    }
  }, [loading, hasCapability, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="spinner h-10 w-10" />
      </div>
    );
  }

  return <>{children}</>;
}
