"use client";

import { useAuth } from "../../context/AuthContext";
import { ProfileForm } from "./ProfileForm";

export default function SettingsPage() {
	const { user, loading: authLoading, updateUser } = useAuth();

	if (authLoading) {
		return (
			<div className="container page-stack flex flex-1 items-center justify-center">
				<div className="spinner" style={{ width: 40, height: 40 }} />
			</div>
		);
	}

	if (!user) {
		return (
			<div className="container page-stack flex flex-1 items-center justify-center">
				<p className="text-muted-copy">Please log in to view your settings.</p>
			</div>
		);
	}

	return <ProfileForm user={user} updateUser={updateUser} />;
}
