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
		<Card className="p-[1.1rem] bg-white border-[#dfd6c8] shadow-sm flex flex-col gap-3">
			<h2 className="text-sm font-extrabold uppercase tracking-wider text-[#24211d]">Author&apos;s Other Books</h2>
			<div className="flex flex-col border border-[#dfd6c8] rounded-md overflow-hidden bg-[#fffdf8]">
				{authorBooks.map((item) => (
					<Link
						key={item._id}
						href={`/books/${item._id}`}
						className="flex gap-3.5 p-3 border-b border-[#dfd6c8]/60 last:border-b-0 hover:bg-[#f8f5ee]/50 transition-all group"
					>
						<div className="w-[48px] h-[64px] bg-[#f8f5ee] border border-[#dfd6c8] rounded flex-shrink-0 overflow-hidden flex items-center justify-center">
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
								<span className="text-xs font-black text-[#405f8f] opacity-40">
									{item.title.slice(0, 2).toUpperCase()}
								</span>
							)}
						</div>

						<div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
							<strong className="text-sm font-bold text-[#24211d] truncate group-hover:text-[#405f8f] transition-colors">
								{item.title}
							</strong>

							<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5f584f]">
								<span className="font-semibold text-[#b65f3d]">{item.translatedChaptersTotal || 0} chapters</span>

								{item.publicationStatus && (
									<>
										<span className="text-[#dfd6c8]">•</span>
										<span className="bg-[#f8f5ee] border border-[#dfd6c8] px-1.5 py-0.5 rounded text-[10px] font-medium text-[#5f584f]">
											{item.publicationStatus}
										</span>
									</>
								)}

								{item.genres && item.genres.length > 0 && (
									<>
										<span className="text-[#dfd6c8]">•</span>
										<span className="truncate max-w-[180px] text-[#877d70]">
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
