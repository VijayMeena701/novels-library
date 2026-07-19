"use client";

import { cn } from '../../lib/utils';

import { useAuth } from "../../context/AuthContext";
import { ProfileForm } from "./ProfileForm";
import { Spinner } from "../../components/ui/spinner";

export default function SettingsPage() {
	const { user, loading: authLoading, updateUser } = useAuth();

	if (authLoading) {
		return (
			<div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12", "flex flex-col gap-5 flex flex-1 items-center justify-center")}>
				<Spinner size="xl" />
			</div>
		);
	}

	if (!user) {
		return (
			<div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12", "flex flex-col gap-5 flex flex-1 items-center justify-center")}>
				<p className="text-muted-copy">Please log in to view your settings.</p>
			</div>
		);
	}

	return <ProfileForm user={user} updateUser={updateUser} />;
}
