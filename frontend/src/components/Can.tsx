import { type ReactNode } from 'react';
import { useAuth } from "../context/AuthContext";

interface CanProps {
  action: string;
  subject: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ action, subject, children, fallback = null }: CanProps) {
  const { ability } = useAuth();
  if (!ability) return <>{fallback}</>;
  return ability.can(action, subject) ? <>{children}</> : <>{fallback}</>;
}
