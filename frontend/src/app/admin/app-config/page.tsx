"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { CAPABILITY } from "../../../utils/permissions";
import { api, type AppConfig, type ReaderModesConfig } from "../../../utils/api";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Switch } from "../../../components/ui/switch";
import { Spinner } from "../../../components/ui/spinner";
import { RefreshCw } from "lucide-react";

interface ReaderModesEditorProps {
	modes: ReaderModesConfig;
	disabled: boolean;
	onChange: (modes: ReaderModesConfig) => void;
}

function ReaderModesEditor({ modes, disabled, onChange }: ReaderModesEditorProps) {
	const keys = ["singlePage", "infinite", "oldReader"] as const;
	return (
		<div className="flex flex-col gap-3">
			{keys.map((key) => (
				<div key={key} className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
					<div className="min-w-0 flex-1">
						<p className="text-sm font-medium text-foreground">{modes[key]?.label ?? key}</p>
						<p className="truncate text-xs text-muted-foreground">{key}</p>
					</div>
					<div className="flex items-center gap-2">
						<label className="text-xs text-muted-foreground">Enabled</label>
						<Switch
							checked={modes[key]?.enabled ?? false}
							onCheckedChange={(checked) => {
								onChange({
									...modes,
									[key]: { ...modes[key], enabled: checked },
								});
							}}
							disabled={disabled}
							aria-label={`Toggle ${key}`}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

export default function AdminAppConfigPage() {
	const { hasCapability } = useAuth();
	const canUpdate = hasCapability(CAPABILITY.APP_CONFIG_UPDATE);

	const [configs, setConfigs] = useState<AppConfig<unknown>[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState<Record<string, boolean>>({});
	const [error, setError] = useState<string | null>(null);

	const fetchConfigs = async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await api.listAdminAppConfigs();
			setConfigs(data.configs);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load app configs.");
			console.error("Failed to load app configs:", err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		void fetchConfigs();
	}, []);

	const handleUpdate = async (name: string, value: unknown) => {
		if (!canUpdate) return;
		setSaving((prev) => ({ ...prev, [name]: true }));
		try {
			await api.updateAdminAppConfig(name, value);
			await fetchConfigs();
		} catch (err) {
			console.error(`Failed to update ${name}:`, err);
		} finally {
			setSaving((prev) => ({ ...prev, [name]: false }));
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold text-foreground">App Configuration</h1>
					<p className="text-sm text-muted-foreground">Manage server-side feature toggles and application settings.</p>
				</div>
				<Button variant="secondary" size="sm" onClick={fetchConfigs} disabled={loading}>
					<RefreshCw className="size-4" />
					Refresh
				</Button>
			</div>

			{loading && configs.length === 0 ? (
				<div className="flex h-48 items-center justify-center">
					<Spinner size="lg" />
				</div>
			) : error ? (
				<p className="text-sm text-destructive">{error}</p>
			) : configs.length === 0 ? (
				<p className="text-sm text-muted-foreground">No app configurations found.</p>
			) : (
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					{configs.map((config) => {
						const isReaderModes = config.name === "reader_modes";
						const value = config.value;
						const isSaving = saving[config.name] ?? false;
						return (
							<Card key={config.name}>
								<CardHeader className="pb-2">
									<CardTitle className="text-base">{config.name}</CardTitle>
									<p className="font-mono text-xs text-muted-foreground">{config.description || "No description."}</p>
								</CardHeader>
								<CardContent>
									{isReaderModes && typeof value === "object" && value !== null ? (
										<div className="space-y-3">
											<ReaderModesEditor
												modes={value as ReaderModesConfig}
												disabled={!canUpdate || isSaving}
												onChange={(updated) => handleUpdate(config.name, updated)}
											/>
										</div>
									) : (
										<textarea
											readOnly={!canUpdate}
											defaultValue={JSON.stringify(value, null, 2)}
											className="min-h-32 w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-copy focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
											onBlur={(event) => {
												try {
													const parsed = JSON.parse(event.target.value);
													handleUpdate(config.name, parsed);
												} catch {
													// Ignore malformed JSON; user must fix it before saving.
												}
											}}
										/>
									)}
									{canUpdate && !isReaderModes && (
										<p className="mt-2 text-xs text-muted-foreground">Edit the JSON and unfocus the field to save.</p>
									)}
									{isSaving && (
										<div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
											<Spinner size="sm" />
											Saving...
										</div>
									)}
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}
		</div>
	);
}
