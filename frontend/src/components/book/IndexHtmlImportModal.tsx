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
		<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[6px]">
			<Card className="w-full max-w-[760px] p-5 flex flex-col gap-4 bg-[#fffdf8] border-[#dfd6c8] shadow-2xl overflow-auto max-h-[90vh]">
				<div className="flex justify-between items-center border-b border-[#dfd6c8] pb-2">
					<h2 className="text-lg font-bold text-[#24211d]">Import {sourceKind === "raw" ? "Raw" : "Translated"} Catalogue HTML</h2>
					<button
						onClick={onClose}
						className="bg-transparent border-0 text-[#877d70] text-2xl cursor-pointer hover:text-[#24211d]"
					>
						&times;
					</button>
				</div>

				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-bold text-[#5f584f]">Catalogue Page URL</label>
						<input
							type="url"
							className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3.5 py-2.5 text-xs outline-none transition-all duration-150 focus:bg-white focus:border-[#405f8f] focus:ring-4 focus:ring-[#405f8f]/10"
							value={indexHtmlPageUrl}
							onChange={(event) => setIndexHtmlPageUrl(event.target.value)}
							required
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-bold text-[#5f584f]">Saved HTML Content</label>
						<textarea
							className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3.5 py-2.5 text-xs outline-none font-mono transition-all duration-150 focus:bg-white focus:border-[#405f8f] focus:ring-4 focus:ring-[#405f8f]/10"
							rows={12}
							value={indexHtmlContent}
							onChange={(event) => setIndexHtmlContent(event.target.value)}
							placeholder="<html>..."
							required
						/>
					</div>

					<div className="flex justify-end gap-2.5 border-t border-[#dfd6c8] pt-3.5 mt-2">
						<Button
							type="button"
							variant="secondary"
							size="sm"
							onClick={onClose}
							disabled={importingIndexHtml}
						>
							Cancel
						</Button>
						<Button type="submit" size="sm" className="bg-[#405f8f] hover:bg-[#304a72] text-white" disabled={importingIndexHtml}>
							{importingIndexHtml ? "Importing..." : "Import Index"}
						</Button>
					</div>
				</form>
			</Card>
		</div>
	);
}
