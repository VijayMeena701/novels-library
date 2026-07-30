export interface ScrollToElementOptions {
  enabled: boolean;
  offset: number;
  behavior: ScrollBehavior;
}

export function scrollToElement(element: HTMLElement, options: ScrollToElementOptions): void {
  if (!options.enabled || typeof window === 'undefined') return;

  // Scroll-margin-top lets scrollIntoView leave the requested offset above
  // the target element while honoring the user's smooth/instant preference.
  const previousScrollMarginTop = element.style.scrollMarginTop;
  element.style.scrollMarginTop = `${options.offset}px`;

  const behavior = options.behavior === 'instant' ? 'auto' : options.behavior;

  try {
    element.scrollIntoView({ behavior, block: 'start', inline: 'nearest' });
  } finally {
    element.style.scrollMarginTop = previousScrollMarginTop;
  }
}
