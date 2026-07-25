"use client";

import { useEffect, useState } from "react";
import type { Book, SourceKind } from "../../utils/api";
import { api } from "../../utils/api";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

interface IndexHtmlImportModalProps {
	book: Book;
	sourceKind: SourceKind;
	isOpen: boolean;
	onClose: () => void;
	onImported: (result: { book: Book; message?: string }) => void;
}

export function IndexHtmlImportModal({ book, sourceKind, isOpen, onClose, onImported }: IndexHtmlImportModalProps) {
	const [indexHtmlPageUrl, setIndexHtmlPageUrl] = useState(sourceKind === "raw" ? book.rawSourceUrl || "" : book.sourceUrl || "");
	const [indexHtmlContent, setIndexHtmlContent] = useState("");
	const [importingIndexHtml, setImportingIndexHtml] = useState(false);

	useEffect(() => {
		if (!isOpen) return;
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setIndexHtmlPageUrl(sourceKind === "raw" ? book.rawSourceUrl || "" : book.sourceUrl || "");
		setIndexHtmlContent("");
	}, [isOpen, sourceKind, book]);

	if (!isOpen) return null;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!book) return;
		setImportingIndexHtml(true);
		try {
			const result = await api.importHtmlIndex(book._id, {
				sourceKind,
				html: indexHtmlContent,
				pageUrl: indexHtmlPageUrl || (sourceKind === "raw" ? book.rawSourceUrl : book.sourceUrl),
			});
			onImported(result);
			onClose();
		} catch (err: unknown) {
			console.error("Failed to import catalogue HTML:", err);
		} finally {
			setImportingIndexHtml(false);
		}
	}

	return (
		<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-scrim backdrop-blur-[6px]">
			<Card className="w-full max-w-[760px] p-5 flex flex-col gap-4 bg-surface border-default shadow-elevation-5 overflow-auto max-h-[90vh]">
				<div className="flex justify-between items-center border-b border-default pb-2">
					<h2 className="text-lg font-bold text-primary">Import {sourceKind === "raw" ? "Raw" : "Translated"} Catalogue HTML</h2>
					<button
						onClick={onClose}
						className="bg-transparent border-0 text-muted text-2xl cursor-pointer hover:text-primary"
					>
						&times;
					</button>
				</div>

				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-bold text-secondary">Catalogue Page URL</label>
						<input
							type="url"
							className="w-full bg-input-bg border border-input rounded-md px-3.5 py-2.5 text-xs outline-none transition-all duration-150 focus:bg-input-bg-focus focus:border-focus focus:ring-4 focus:ring-focus/20"
							value={indexHtmlPageUrl}
							onChange={(event) => setIndexHtmlPageUrl(event.target.value)}
							required
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-bold text-secondary">Saved HTML Content</label>
						<textarea
							className="w-full bg-input-bg border border-input rounded-md px-3.5 py-2.5 text-xs outline-none font-mono transition-all duration-150 focus:bg-input-bg-focus focus:border-focus focus:ring-4 focus:ring-focus/20"
							rows={12}
							value={indexHtmlContent}
							onChange={(event) => setIndexHtmlContent(event.target.value)}
							placeholder="<html>..."
							required
						/>
					</div>

					<div className="flex justify-end gap-2.5 border-t border-default pt-3.5 mt-2">
						<Button
							type="button"
							variant="secondary"
							size="sm"
							onClick={onClose}
							disabled={importingIndexHtml}
						>
							Cancel
						</Button>
						<Button type="submit" size="sm" className="bg-accent hover:bg-accent-hover text-inverse" disabled={importingIndexHtml}>
							{importingIndexHtml ? "Importing..." : "Import Index"}
						</Button>
					</div>
				</form>
			</Card>
		</div>
	);
}
