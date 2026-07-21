"use client";

import { useCallback, useEffect, useState } from "react";
import {
	api,
	type User,
	type PronunciationRule,
	type CreatePronunciationRulePayload,
	type UpdatePronunciationRulePayload,
} from "../utils/api";

export interface UsePronunciationRulesReturn {
	rules: PronunciationRule[];
	loading: boolean;
	error: string;
	create: (data: CreatePronunciationRulePayload) => Promise<void>;
	update: (ruleId: string, data: UpdatePronunciationRulePayload) => Promise<void>;
	remove: (ruleId: string) => Promise<void>;
}

export function usePronunciationRules(bookId: string | undefined, user: User | null): UsePronunciationRulesReturn {
	const [rules, setRules] = useState<PronunciationRule[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		async function loadRules() {
			setLoading(true);
			setError("");
			try {
				if (bookId && user) {
					const loaded = await api.getPronunciationRules(bookId);
					setRules(loaded);
				} else {
					setRules([]);
				}
			} catch (err: unknown) {
				console.error("Failed to load pronunciation rules:", err);
				setError("Could not retrieve custom speech rules.");
			} finally {
				setLoading(false);
			}
		}

		void loadRules();
	}, [bookId, user]);

	const create = useCallback(
		async (data: CreatePronunciationRulePayload) => {
			if (!bookId) return;
			const created = await api.createPronunciationRule(bookId, data);
			setRules((prev) => [created, ...prev]);
		},
		[bookId],
	);

	const update = useCallback(
		async (ruleId: string, data: UpdatePronunciationRulePayload) => {
			const updated = await api.updatePronunciationRule(ruleId, data);
			setRules((prev) => prev.map((rule) => (rule._id === ruleId ? updated : rule)));
		},
		[],
	);

	const remove = useCallback(async (ruleId: string) => {
		await api.deletePronunciationRule(ruleId);
		setRules((prev) => prev.filter((rule) => rule._id !== ruleId));
	}, []);

	return { rules, loading, error, create, update, remove };
}
