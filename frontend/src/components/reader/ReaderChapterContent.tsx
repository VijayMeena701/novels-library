"use client";

import { type CSSProperties, forwardRef, type MouseEvent } from "react";
import { SPEECH_BLOCK_SELECTOR, isSpeechLeafBlock } from "../../lib/reader-utils";

interface ReaderChapterContentProps {
	content: string;
	fontSize: number;
	onClick: (startBlockIndex: number) => void;
}

export const ReaderChapterContent = forwardRef<HTMLDivElement, ReaderChapterContentProps>(function ReaderChapterContent(
	{ content, fontSize, onClick },
	ref,
) {
	const handleClick = (event: MouseEvent<HTMLDivElement>) => {
		const root = (ref && "current" in ref ? ref.current : null) as HTMLDivElement | null;
		const target = event.target as HTMLElement | null;
		if (!root || !target) return;

		const block = target.closest(SPEECH_BLOCK_SELECTOR) as HTMLElement | null;
		if (!block || !root.contains(block)) return;
		if (!isSpeechLeafBlock(block)) return;

		const nodes = Array.from(root.querySelectorAll(SPEECH_BLOCK_SELECTOR)).filter(
			(node): node is HTMLElement => node instanceof HTMLElement && isSpeechLeafBlock(node),
		);
		const blockIndex = nodes.findIndex((item) => item === block);
		if (blockIndex < 0) return;
		onClick(blockIndex);
	};

	const readerContentStyle: CSSProperties = {
		fontSize: `${fontSize}px`,
	};

	return (
		<div
			ref={ref}
			className="text-[var(--reader-text)] [line-break:anywhere] [&_p]:mt-0 [&_p]:mb-[1.6em] [&_p]:cursor-pointer [&_li]:cursor-pointer [&_blockquote]:cursor-pointer [&_h1]:cursor-pointer [&_h2]:cursor-pointer [&_h3]:cursor-pointer [&_h4]:cursor-pointer [&_p]:scroll-mt-28 [&_li]:scroll-mt-28 [&_blockquote]:scroll-mt-28 [&_h1]:scroll-mt-28 [&_h2]:scroll-mt-28 [&_h3]:scroll-mt-28 [&_h4]:scroll-mt-28 [&_p]:rounded-sm [&_li]:rounded-sm [&_blockquote]:rounded-sm [&_h1]:rounded-sm [&_h2]:rounded-sm [&_h3]:rounded-sm [&_h4]:rounded-sm [&_p]:transition-[background-color,box-shadow] [&_li]:transition-[background-color,box-shadow] [&_blockquote]:transition-[background-color,box-shadow] [&_h1]:transition-[background-color,box-shadow] [&_h2]:transition-[background-color,box-shadow] [&_h3]:transition-[background-color,box-shadow] [&_h4]:transition-[background-color,box-shadow] [&_p]:duration-[160ms] [&_li]:duration-[160ms] [&_blockquote]:duration-[160ms] [&_h1]:duration-[160ms] [&_h2]:duration-[160ms] [&_h3]:duration-[160ms] [&_h4]:duration-[160ms] [&_p]:ease-[ease] [&_li]:ease-[ease] [&_blockquote]:ease-[ease] [&_h1]:ease-[ease] [&_h2]:ease-[ease] [&_h3]:ease-[ease] [&_h4]:ease-[ease] [&_p:hover]:bg-[color-mix(in_srgb,var(--reader-accent)_7%,transparent)] [&_li:hover]:bg-[color-mix(in_srgb,var(--reader-accent)_7%,transparent)] [&_blockquote:hover]:bg-[color-mix(in_srgb,var(--reader-accent)_7%,transparent)] [&_img]:max-w-full [&_img]:h-auto"
			style={readerContentStyle}
			onClick={handleClick}
			dangerouslySetInnerHTML={{ __html: content }}
		/>
	);
});
