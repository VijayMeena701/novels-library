import { cva } from "class-variance-authority";

export const readerContainerVariants = cva(
	"min-h-screen bg-reader text-reader-paragraph antialiased",
);

export const readerToolbarVariants = cva(
	"sticky top-0 z-40 flex items-center justify-between border-b border-reader bg-reader-toolbar px-4 py-3",
);

export const readerChapterContentVariants = cva(
	"max-w-none leading-relaxed",
);
