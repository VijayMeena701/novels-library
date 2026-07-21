"use client";

import type { Book } from "../../utils/api";
import { Card } from "../ui/card";

interface BookSummarySectionProps {
	book: Book;
}

export function BookSummarySection({ book }: BookSummarySectionProps) {
	return (
		<Card className="p-[1.1rem] bg-white border-[#dfd6c8] shadow-sm flex flex-col gap-3">
			<h2 className="text-base font-bold text-[#24211d]">Book Summary</h2>
			<p className="text-sm leading-relaxed whitespace-pre-line text-[#5f584f]">
				{book.description || "No summary has been indexed for this book yet."}
			</p>
		</Card>
	);
}
