"use client";

import React, { useState } from "react";
import { Globe2, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "../../lib/utils";
import type { CreatePronunciationRulePayload, PronunciationRule, UpdatePronunciationRulePayload } from "../../utils/api";

export interface PronunciationRulesModalProps {
	open: boolean;
	onClose: () => void;
	bookTitle: string;
	rules: PronunciationRule[];
	loading: boolean;
	error?: string;
	onCreate: (payload: CreatePronunciationRulePayload) => Promise<void>;
	onUpdate: (ruleId: string, payload: UpdatePronunciationRulePayload) => Promise<void>;
	onDelete: (ruleId: string) => Promise<void>;
}

interface RuleFormState {
	pattern: string;
	replacement: string;
	wholeWord: boolean;
	caseSensitive: boolean;
	isGlobal: boolean;
}

const EMPTY_FORM: RuleFormState = {
	pattern: "",
	replacement: "",
	wholeWord: true,
	caseSensitive: false,
	isGlobal: false,
};

function ToggleChip({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
	return (
		<button
			type="button"
			onClick={() => onChange(!checked)}
			aria-pressed={checked}
			className={cn(
				"rounded-md border px-2.5 py-1.5 text-[0.7rem] font-bold transition",
				checked ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted-copy hover:text-foreground",
			)}
		>
			{label}
		</button>
	);
}

export function PronunciationRulesModal(props: PronunciationRulesModalProps) {
	const { open, onClose, bookTitle, rules, loading, error, onCreate, onUpdate, onDelete } = props;

	const [form, setForm] = useState<RuleFormState>(EMPTY_FORM);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [formError, setFormError] = useState("");
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

	const handleClose = () => {
		setForm(EMPTY_FORM);
		setEditingId(null);
		setFormError("");
		onClose();
	};

	if (!open) return null;

	const bookRules = rules.filter((rule) => !rule.isGlobal);
	const globalRules = rules.filter((rule) => rule.isGlobal);

	const startEdit = (rule: PronunciationRule) => {
		setEditingId(rule._id);
		setForm({
			pattern: rule.pattern,
			replacement: rule.replacement,
			wholeWord: rule.wholeWord,
			caseSensitive: rule.caseSensitive,
			isGlobal: rule.isGlobal,
		});
		setFormError("");
	};

	const cancelEdit = () => {
		setEditingId(null);
		setForm(EMPTY_FORM);
		setFormError("");
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const pattern = form.pattern.trim();
		if (!pattern) {
			setFormError("Enter a word, character, or phrase to match.");
			return;
		}

		setSubmitting(true);
		setFormError("");
		try {
			const payload = {
				pattern,
				replacement: form.replacement,
				wholeWord: form.wholeWord,
				caseSensitive: form.caseSensitive,
				isGlobal: form.isGlobal,
			};
			if (editingId) {
				await onUpdate(editingId, payload);
			} else {
				await onCreate(payload);
			}
			setForm(EMPTY_FORM);
			setEditingId(null);
		} catch (err) {
			setFormError(err instanceof Error ? err.message : "Could not save this pronunciation rule.");
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async (ruleId: string) => {
		setPendingDeleteId(ruleId);
		try {
			await onDelete(ruleId);
			if (editingId === ruleId) cancelEdit();
		} finally {
			setPendingDeleteId(null);
		}
	};

	const handleToggleEnabled = async (rule: PronunciationRule) => {
		await onUpdate(rule._id, { enabled: !rule.enabled });
	};

	const renderRuleRow = (rule: PronunciationRule) => (
		<li key={rule._id} className={cn("flex flex-col gap-1.5 rounded-md border border-border bg-surface p-2.5 transition", !rule.enabled && "opacity-50")}>
			<div className="flex items-start justify-between gap-2">
				<div className="flex min-w-0 flex-col">
					<span className="truncate text-xs font-bold text-foreground">
						&ldquo;{rule.pattern}&rdquo; <span className="text-muted-copy">&rarr;</span>{" "}
						{rule.replacement ? `"${rule.replacement}"` : <em className="text-muted-copy">skip / muted</em>}
					</span>
					<span className="flex flex-wrap items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-wide text-muted-copy">
						{rule.isGlobal && (
							<span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-1.5 py-0.5 text-primary">
								<Globe2 className="size-2.5" /> All books
							</span>
						)}
						{rule.wholeWord && <span>Whole word</span>}
						{rule.caseSensitive && <span>Case sensitive</span>}
					</span>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<button
						type="button"
						onClick={() => handleToggleEnabled(rule)}
						aria-pressed={rule.enabled}
						aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
						className={cn(
							"relative inline-flex h-5 w-9 shrink-0 items-center rounded-lg border transition-colors duration-200",
							rule.enabled ? "border-primary bg-primary" : "border-border bg-surface",
						)}
					>
						<span
							className={cn(
								"inline-block size-3.5 transform rounded-lg bg-background shadow-card transition-transform duration-200",
								rule.enabled ? "translate-x-4" : "translate-x-1",
							)}
						/>
					</button>
					<button
						type="button"
						onClick={() => startEdit(rule)}
						aria-label="Edit rule"
						className="flex size-7 items-center justify-center rounded-md border border-border text-muted-copy hover:text-foreground"
					>
						<Pencil className="size-3.5" />
					</button>
					<button
						type="button"
						onClick={() => handleDelete(rule._id)}
						disabled={pendingDeleteId === rule._id}
						aria-label="Delete rule"
						className="flex size-7 items-center justify-center rounded-md border border-border text-muted-copy hover:text-red-500 disabled:opacity-40"
					>
						<Trash2 className="size-3.5" />
					</button>
				</div>
			</div>
		</li>
	);

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3" onClick={handleClose}>
			<div
				className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3.5 overflow-y-auto rounded-lg border border-border bg-card p-4 text-foreground shadow-elevated scrollbar-thin"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-start justify-between gap-2">
					<div>
						<h2 className="text-sm font-black uppercase tracking-wide text-copy">Pronunciation &amp; TTS Rules</h2>
						<p className="text-xs text-muted-copy">
							Customize how the reader speaks words or phrases in <strong className="text-copy">{bookTitle}</strong>. Leave the replacement empty
							to skip a word entirely.
						</p>
					</div>
					<button
						type="button"
						onClick={handleClose}
						aria-label="Close pronunciation rules"
						className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-copy hover:text-foreground"
					>
						<X className="size-4" />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="flex flex-col gap-2.5 rounded-md border border-border bg-surface-muted p-3">
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
						<div className="flex flex-col gap-1">
							<span className="text-[0.65rem] font-black uppercase tracking-wider text-muted-copy">Match</span>
							<input
								type="text"
								value={form.pattern}
								onChange={(event) => setForm((prev) => ({ ...prev, pattern: event.target.value }))}
								placeholder='e.g. "hey"'
								maxLength={200}
								className="min-h-9 w-full rounded-md border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-primary focus:shadow-focus"
							/>
						</div>
						<div className="flex flex-col gap-1">
							<span className="text-[0.65rem] font-black uppercase tracking-wider text-muted-copy">Speak as (blank = skip)</span>
							<input
								type="text"
								value={form.replacement}
								onChange={(event) => setForm((prev) => ({ ...prev, replacement: event.target.value }))}
								placeholder='e.g. "hi"'
								maxLength={500}
								className="min-h-9 w-full rounded-md border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-primary focus:shadow-focus"
							/>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-1.5">
						<ToggleChip
							label="Whole word only"
							checked={form.wholeWord}
							onChange={(checked) => setForm((prev) => ({ ...prev, wholeWord: checked }))}
						/>
						<ToggleChip
							label="Case sensitive"
							checked={form.caseSensitive}
							onChange={(checked) => setForm((prev) => ({ ...prev, caseSensitive: checked }))}
						/>
						<ToggleChip
							label="Apply to all my books"
							checked={form.isGlobal}
							onChange={(checked) => setForm((prev) => ({ ...prev, isGlobal: checked }))}
						/>
					</div>

					{formError && <p className="text-[0.7rem] font-semibold text-red-500">{formError}</p>}

					<div className="flex items-center gap-2">
						<button
							type="submit"
							disabled={submitting}
							className="flex min-h-8 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-background transition hover:bg-primary-hover disabled:opacity-50"
						>
							<Plus className="size-3.5" />
							{editingId ? "Save changes" : "Add rule"}
						</button>
						{editingId && (
							<button
								type="button"
								onClick={cancelEdit}
								className="min-h-8 rounded-md border border-border px-3 py-1.5 text-xs font-bold text-copy hover:bg-surface-muted"
							>
								Cancel
							</button>
						)}
					</div>
				</form>

				{error && <p className="text-[0.7rem] font-semibold text-red-500">{error}</p>}

				{loading ? (
					<p className="text-xs text-muted-copy">Loading rules…</p>
				) : rules.length === 0 ? (
					<p className="text-xs text-muted-copy">No pronunciation rules yet. Add one above to customize this book&apos;s TTS.</p>
				) : (
					<div className="flex flex-col gap-3">
						{bookRules.length > 0 && (
							<div className="flex flex-col gap-1.5">
								<span className="text-[0.65rem] font-black uppercase tracking-wider text-muted-copy">This book</span>
								<ul className="flex flex-col gap-1.5">{bookRules.map(renderRuleRow)}</ul>
							</div>
						)}
						{globalRules.length > 0 && (
							<div className="flex flex-col gap-1.5">
								<span className="text-[0.65rem] font-black uppercase tracking-wider text-muted-copy">All books</span>
								<ul className="flex flex-col gap-1.5">{globalRules.map(renderRuleRow)}</ul>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
