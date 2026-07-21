"use client";

import { useEffect, useState } from "react";
import type { Book } from "../../utils/api";
import { api } from "../../utils/api";
import { useToast } from "../../context/ToastContext";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

interface CatalogEditModalProps {
	book: Book;
	isOpen: boolean;
	onClose: () => void;
	onSaved: (updated: Book) => void;
}

export function CatalogEditModal({ book, isOpen, onClose, onSaved }: CatalogEditModalProps) {
	const { showToast } = useToast();
	const [editingCatalog, setEditingCatalog] = useState(false);

	const [editTitle, setEditTitle] = useState(book.title || "");
	const [editAuthor, setEditAuthor] = useState(book.author || "");
	const [editAuthorPenName, setEditAuthorPenName] = useState(book.authorPenName || "");
	const [editAuthorRealName, setEditAuthorRealName] = useState(book.authorRealName || "");
	const [editAlternativeNames, setEditAlternativeNames] = useState((book.alternativeNames || []).join(", "));
	const [editGenres, setEditGenres] = useState((book.genres || []).join(", "));
	const [editOriginalSource, setEditOriginalSource] = useState(book.originalSource || "");
	const [editPublicationStatus, setEditPublicationStatus] = useState(book.publicationStatus || "");
	const [editDescription, setEditDescription] = useState(book.description || "");
	const [editCoverUrl, setEditCoverUrl] = useState(book.coverUrl || "");
	const [editSourceUrl, setEditSourceUrl] = useState(book.sourceUrl || "");
	const [editRawSourceUrl, setEditRawSourceUrl] = useState(book.rawSourceUrl || "");
	const [editRawOriginalLanguage, setEditRawOriginalLanguage] = useState(book.rawOriginalLanguage || "");

	useEffect(() => {
		if (!isOpen) return;
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setEditTitle(book.title || "");
		setEditAuthor(book.author || "");
		setEditAuthorPenName(book.authorPenName || "");
		setEditAuthorRealName(book.authorRealName || "");
		setEditAlternativeNames((book.alternativeNames || []).join(", "));
		setEditGenres((book.genres || []).join(", "));
		setEditOriginalSource(book.originalSource || "");
		setEditPublicationStatus(book.publicationStatus || "");
		setEditDescription(book.description || "");
		setEditCoverUrl(book.coverUrl || "");
		setEditSourceUrl(book.sourceUrl || "");
		setEditRawSourceUrl(book.rawSourceUrl || "");
		setEditRawOriginalLanguage(book.rawOriginalLanguage || "");
	}, [isOpen, book]);

	if (!isOpen) return null;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setEditingCatalog(true);
		try {
			const updates: Partial<Book> = {
				title: editTitle,
				author: editAuthor,
				authorPenName: editAuthorPenName,
				authorRealName: editAuthorRealName,
				alternativeNames: editAlternativeNames
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean),
				genres: editGenres
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean),
				originalSource: editOriginalSource,
				publicationStatus: editPublicationStatus,
				description: editDescription,
				coverUrl: editCoverUrl,
				sourceUrl: editSourceUrl,
				rawSourceUrl: editRawSourceUrl,
				rawOriginalLanguage: editRawOriginalLanguage,
			};
			const updated = await api.updateCatalogBook(book._id, updates);
			onSaved(updated);
			onClose();
		} catch (err: unknown) {
			console.error("Failed to update catalog book:", err);
			showToast({ message: err instanceof Error ? err.message : "Failed to update catalog book.", variant: "error" });
		} finally {
			setEditingCatalog(false);
		}
	}

	return (
		<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[6px]">
			<Card className="w-full max-w-[760px] p-5 flex flex-col gap-4 bg-[#fffdf8] border-[#dfd6c8] shadow-2xl overflow-auto max-h-[90vh]">
				<div className="flex justify-between items-center border-b border-[#dfd6c8] pb-2">
					<h2 className="text-lg font-bold text-[#24211d]">Edit Catalog Metadata</h2>
					<button
						onClick={onClose}
						className="bg-transparent border-0 text-[#877d70] text-2xl cursor-pointer hover:text-[#24211d]"
					>
						&times;
					</button>
				</div>

				<form onSubmit={handleSubmit} className="flex flex-col gap-3">
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-bold text-[#5f584f]">Title</label>
						<input
							type="text"
							className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white focus:border-[#405f8f]"
							value={editTitle}
							onChange={(e) => setEditTitle(e.target.value)}
							required
						/>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
						<div className="flex flex-col gap-1.5">
							<label className="text-xs font-bold text-[#5f584f]">Author</label>
							<input
								type="text"
								className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white focus:border-[#405f8f]"
								value={editAuthor}
								onChange={(e) => setEditAuthor(e.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<label className="text-xs font-bold text-[#5f584f]">Author Pen Name</label>
							<input
								type="text"
								className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white focus:border-[#405f8f]"
								value={editAuthorPenName}
								onChange={(e) => setEditAuthorPenName(e.target.value)}
							/>
						</div>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-bold text-[#5f584f]">Author Real Name</label>
						<input
							type="text"
							className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
							value={editAuthorRealName}
							onChange={(e) => setEditAuthorRealName(e.target.value)}
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-bold text-[#5f584f]">Alternative Names (comma-separated)</label>
						<input
							type="text"
							className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
							value={editAlternativeNames}
							onChange={(e) => setEditAlternativeNames(e.target.value)}
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-bold text-[#5f584f]">Genres (comma-separated)</label>
						<input
							type="text"
							className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
							value={editGenres}
							onChange={(e) => setEditGenres(e.target.value)}
						/>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
						<div className="flex flex-col gap-1.5">
							<label className="text-xs font-bold text-[#5f584f]">Publication Status</label>
							<input
								type="text"
								className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
								value={editPublicationStatus}
								onChange={(e) => setEditPublicationStatus(e.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<label className="text-xs font-bold text-[#5f584f]">Raw Original Language</label>
							<input
								type="text"
								className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
								value={editRawOriginalLanguage}
								onChange={(e) => setEditRawOriginalLanguage(e.target.value)}
							/>
						</div>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-bold text-[#5f584f]">Original Source</label>
						<input
							type="url"
							className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
							value={editOriginalSource}
							onChange={(e) => setEditOriginalSource(e.target.value)}
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-bold text-[#5f584f]">Source URL</label>
						<input
							type="url"
							className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
							value={editSourceUrl}
							onChange={(e) => setEditSourceUrl(e.target.value)}
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-bold text-[#5f584f]">Raw Source URL</label>
						<input
							type="url"
							className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
							value={editRawSourceUrl}
							onChange={(e) => setEditRawSourceUrl(e.target.value)}
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-bold text-[#5f584f]">Cover URL</label>
						<input
							type="url"
							className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
							value={editCoverUrl}
							onChange={(e) => setEditCoverUrl(e.target.value)}
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-bold text-[#5f584f]">Description</label>
						<textarea
							className="w-full bg-[#fffdf8] border border-[#dfd6c8] rounded-md px-3 py-2 text-xs outline-none transition-all focus:bg-white"
							rows={4}
							value={editDescription}
							onChange={(e) => setEditDescription(e.target.value)}
						/>
					</div>

					<div className="flex justify-end gap-2.5 border-t border-[#dfd6c8] pt-3 mt-2">
						<Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={editingCatalog}>
							Cancel
						</Button>
						<Button type="submit" size="sm" className="bg-[#405f8f] hover:bg-[#304a72] text-white" disabled={editingCatalog}>
							{editingCatalog ? "Saving..." : "Save Changes"}
						</Button>
					</div>
				</form>
			</Card>
		</div>
	);
}
