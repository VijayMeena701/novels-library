"use client";

import type { BookReview } from "../../utils/api";
import { Card } from "../ui/card";

interface BookReviewsSectionProps {
	reviews: BookReview[];
}

export function BookReviewsSection({ reviews }: BookReviewsSectionProps) {
	if (reviews.length === 0) return null;

	return (
		<Card className="p-[1.1rem] bg-white border-[#dfd6c8] shadow-sm flex flex-col gap-3">
			<h2 className="text-base font-bold text-[#24211d]">Reviews ({reviews.length})</h2>
			<div className="flex flex-col gap-3">
				{reviews.slice(0, 5).map((review) => (
					<div key={review._id} className="border-b border-[#dfd6c8]/60 last:border-b-0 pb-3 last:pb-0">
						<div className="flex items-center justify-between gap-2">
							<strong className="text-sm font-bold text-[#24211d]">{review.username}</strong>
							<span className="text-[10px] text-[#877d70]">{new Date(review.createdAt).toLocaleDateString()}</span>
						</div>
						<p className="text-sm text-[#5f584f] mt-1 whitespace-pre-line">{review.review}</p>
					</div>
				))}
			</div>
		</Card>
	);
}
