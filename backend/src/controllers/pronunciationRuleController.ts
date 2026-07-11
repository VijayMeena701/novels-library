import { FastifyReply, FastifyRequest } from "fastify";
import { Novel } from "../models/Novel.js";
import { PronunciationRule } from "../models/PronunciationRule.js";

interface PronunciationRulePatch {
	pattern?: string;
	replacement?: string;
	wholeWord?: boolean;
	caseSensitive?: boolean;
	enabled?: boolean;
	isGlobal?: boolean;
}

function cleanPattern(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim().slice(0, 200);
	return trimmed || undefined;
}

function cleanReplacement(value: unknown): string {
	if (typeof value !== "string") return "";
	return value.slice(0, 500);
}

function cleanBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

// List rules relevant to a novel: the user's global rules plus any rules scoped to this novel.
export async function listPronunciationRulesHandler(request: FastifyRequest, reply: FastifyReply) {
	const userId = (request.user as any).id;
	const { id: novelId } = request.params as any;

	try {
		const rules = await PronunciationRule.find({
			userId,
			$or: [{ isGlobal: true }, { novelId }],
		}).sort({ isGlobal: 1, createdAt: 1 });

		return reply.send(rules);
	} catch (err: any) {
		request.log.error(err);
		return reply.status(500).send({ error: "Server error listing pronunciation rules." });
	}
}

export async function createPronunciationRuleHandler(request: FastifyRequest, reply: FastifyReply) {
	const userId = (request.user as any).id;
	const { id: novelId } = request.params as any;
	const body = (request.body || {}) as PronunciationRulePatch;

	const pattern = cleanPattern(body.pattern);
	if (!pattern) {
		return reply.status(400).send({ error: "A word, character, or phrase to match is required." });
	}

	try {
		const novel = await Novel.findById(novelId).select("_id");
		if (!novel) {
			return reply.status(404).send({ error: "Novel not found." });
		}

		const isGlobal = cleanBoolean(body.isGlobal, false);
		const rule = await PronunciationRule.create({
			userId,
			novelId: isGlobal ? null : novelId,
			isGlobal,
			pattern,
			replacement: cleanReplacement(body.replacement),
			wholeWord: cleanBoolean(body.wholeWord, true),
			caseSensitive: cleanBoolean(body.caseSensitive, false),
			enabled: cleanBoolean(body.enabled, true),
		});

		return reply.status(201).send(rule);
	} catch (err: any) {
		request.log.error(err);
		return reply.status(500).send({ error: "Server error creating pronunciation rule." });
	}
}

export async function updatePronunciationRuleHandler(request: FastifyRequest, reply: FastifyReply) {
	const userId = (request.user as any).id;
	const { ruleId } = request.params as any;
	const body = (request.body || {}) as PronunciationRulePatch;

	try {
		const rule = await PronunciationRule.findOne({ _id: ruleId, userId });
		if (!rule) {
			return reply.status(404).send({ error: "Pronunciation rule not found." });
		}

		if (body.pattern !== undefined) {
			const pattern = cleanPattern(body.pattern);
			if (!pattern) {
				return reply.status(400).send({ error: "A word, character, or phrase to match is required." });
			}
			rule.pattern = pattern;
		}

		if (body.replacement !== undefined) {
			rule.replacement = cleanReplacement(body.replacement);
		}
		if (body.wholeWord !== undefined) {
			rule.wholeWord = cleanBoolean(body.wholeWord, rule.wholeWord);
		}
		if (body.caseSensitive !== undefined) {
			rule.caseSensitive = cleanBoolean(body.caseSensitive, rule.caseSensitive);
		}
		if (body.enabled !== undefined) {
			rule.enabled = cleanBoolean(body.enabled, rule.enabled);
		}
		if (body.isGlobal !== undefined) {
			const isGlobal = cleanBoolean(body.isGlobal, rule.isGlobal);
			rule.isGlobal = isGlobal;
			if (isGlobal) {
				rule.novelId = null;
			} else if (!rule.novelId) {
				// Downgrading from global to novel-specific requires a novel to attach to.
				return reply.status(400).send({ error: "Cannot make this rule novel-specific without a novel context." });
			}
		}

		await rule.save();
		return reply.send(rule);
	} catch (err: any) {
		request.log.error(err);
		return reply.status(500).send({ error: "Server error updating pronunciation rule." });
	}
}

export async function deletePronunciationRuleHandler(request: FastifyRequest, reply: FastifyReply) {
	const userId = (request.user as any).id;
	const { ruleId } = request.params as any;

	try {
		const result = await PronunciationRule.deleteOne({ _id: ruleId, userId });
		if (result.deletedCount === 0) {
			return reply.status(404).send({ error: "Pronunciation rule not found." });
		}

		return reply.send({ success: true, message: "Pronunciation rule deleted." });
	} catch (err: any) {
		request.log.error(err);
		return reply.status(500).send({ error: "Server error deleting pronunciation rule." });
	}
}
