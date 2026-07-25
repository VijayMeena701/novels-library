"use client";

import Image from "next/image";
import Link from "next/link";
import type { Book } from "../../utils/api";
import { Card } from "../ui/card";

interface BookAuthorBooksProps {
	authorBooks: Book[];
}

export function BookAuthorBooks({ authorBooks }: BookAuthorBooksProps) {
	if (authorBooks.length === 0) return null;

	return (
		<Card className="p-[1.1rem] bg-surface border-default shadow-elevation-1 flex flex-col gap-3">
			<h2 className="text-sm font-extrabold uppercase tracking-wider text-primary">Author&apos;s Other Books</h2>
			<div className="flex flex-col border border-default rounded-md overflow-hidden bg-surface">
				{authorBooks.map((item) => (
					<Link
						key={item._id}
						href={`/books/${item._id}`}
						className="flex gap-3.5 p-3 border-b border-default/60 last:border-b-0 hover:bg-surface-raised/50 transition-all group"
					>
						<div className="w-[48px] h-[64px] bg-surface-raised border border-default rounded flex-shrink-0 overflow-hidden flex items-center justify-center">
							{item.coverUrl ? (
								<Image
									src={item.coverUrl}
									alt={item.title}
									width={48}
									height={64}
									unoptimized
									className="w-full h-full object-cover transition-transform group-hover:scale-105"
								/>
							) : (
								<span className="text-xs font-black text-accent opacity-40">
									{item.title.slice(0, 2).toUpperCase()}
								</span>
							)}
						</div>

						<div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
							<strong className="text-sm font-bold text-primary truncate group-hover:text-accent transition-colors">
								{item.title}
							</strong>

							<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
								<span className="font-semibold text-warning">{item.translatedChaptersTotal || 0} chapters</span>

								{item.publicationStatus && (
									<>
										<span className="text-muted">•</span>
										<span className="bg-surface-raised border border-default px-1.5 py-0.5 rounded text-[10px] font-medium text-secondary">
											{item.publicationStatus}
										</span>
									</>
								)}

								{item.genres && item.genres.length > 0 && (
									<>
										<span className="text-muted">•</span>
										<span className="truncate max-w-[180px] text-muted">
											{item.genres.slice(0, 2).join(", ")}
										</span>
									</>
								)}
							</div>
						</div>
					</Link>
				))}
			</div>
		</Card>
	);
}
