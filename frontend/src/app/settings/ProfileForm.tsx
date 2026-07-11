"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "../../utils/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

interface ProfileFormProps {
	user: User;
	updateUser: (payload: { username?: string; avatarUrl?: string }) => Promise<void>;
}

export function ProfileForm({ user, updateUser }: ProfileFormProps) {
	const router = useRouter();
	const [username, setUsername] = useState(user.username);
	const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		setMessage(null);

		try {
			await updateUser({ username: username || undefined, avatarUrl: avatarUrl || undefined });
			setMessage("Profile updated successfully.");
		} catch (err) {
			setMessage(err instanceof Error ? err.message : "Failed to update profile.");
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="container page-stack">
			<div className="page-header">
				<div>
					<h1 className="page-title">Settings</h1>
					<p className="page-subtitle">Manage your profile and preferences.</p>
				</div>
				<Button variant="secondary" onClick={() => router.push("/profile")}>
					Back to Profile
				</Button>
			</div>

			<form onSubmit={handleSubmit} className="grid max-w-xl gap-6">
				<Card>
					<CardHeader>
						<CardTitle>Profile</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						{message && (
							<div
								className={`rounded-md px-3 py-2 text-sm font-bold ${
									message.includes("success") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
								}`}
							>
								{message}
							</div>
						)}

						<div className="grid gap-2">
							<label htmlFor="username" className="text-xs font-extrabold uppercase tracking-wide text-muted-copy">
								Username
							</label>
							<Input
								id="username"
								type="text"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								required
							/>
						</div>

						<div className="grid gap-2">
							<label htmlFor="email" className="text-xs font-extrabold uppercase tracking-wide text-muted-copy">
								Email
							</label>
							<Input id="email" type="email" value={user.email} disabled />
						</div>

						<div className="grid gap-2">
							<label htmlFor="avatar" className="text-xs font-extrabold uppercase tracking-wide text-muted-copy">
								Avatar URL
							</label>
							<Input
								id="avatar"
								type="url"
								value={avatarUrl}
								onChange={(e) => setAvatarUrl(e.target.value)}
								placeholder="https://example.com/avatar.jpg"
							/>
						</div>

						<Button type="submit" disabled={saving}>
							{saving ? <span className="spinner" /> : "Save Profile"}
						</Button>
					</CardContent>
				</Card>
			</form>
		</div>
	);
}
