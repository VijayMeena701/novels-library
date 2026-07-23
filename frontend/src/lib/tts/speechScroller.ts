import { getScrollParent } from "@/lib/reader-utils";

export interface ScrollToElementOptions {
	enabled: boolean;
	offset: number;
	behavior: ScrollBehavior;
}

export function scrollToElement(element: HTMLElement, options: ScrollToElementOptions): void {
	if (!options.enabled || typeof window === "undefined") return;

	const parent = getScrollParent(element);
	if (parent === window) {
		const rect = element.getBoundingClientRect();
		const targetScrollY = window.scrollY + rect.top - options.offset;
		window.scrollTo({ top: targetScrollY, behavior: options.behavior });
	} else if (parent instanceof HTMLElement) {
		const rect = element.getBoundingClientRect();
		const parentRect = parent.getBoundingClientRect();
		const targetScrollTop = parent.scrollTop + rect.top - parentRect.top - options.offset;
		parent.scrollTo({ top: targetScrollTop, behavior: options.behavior });
	}
}
