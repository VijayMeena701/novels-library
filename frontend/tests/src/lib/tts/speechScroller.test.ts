import { vi, describe, it, expect } from 'vitest';
import { scrollToElement } from '@/lib/tts/speechScroller';

describe('scrollToElement', () => {
  it('does nothing when scrolling is disabled', () => {
    const element = document.createElement('p');
    const scrollIntoView = vi.spyOn(element, 'scrollIntoView').mockImplementation(() => {});

    scrollToElement(element, { enabled: false, offset: 100, behavior: 'smooth' });

    expect(scrollIntoView).not.toHaveBeenCalled();
    scrollIntoView.mockRestore();
  });

  it('scrolls the element into view with the requested behavior and offset', () => {
    const element = document.createElement('p');
    let capturedScrollMarginTop = '';
    const scrollIntoView = vi.spyOn(element, 'scrollIntoView').mockImplementation((options?: unknown) => {
      capturedScrollMarginTop = element.style.scrollMarginTop;
      return options;
    });

    scrollToElement(element, { enabled: true, offset: 140, behavior: 'smooth' });

    expect(capturedScrollMarginTop).toBe('140px');
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
    expect(element.style.scrollMarginTop).toBe('');
    scrollIntoView.mockRestore();
  });

  it('maps instant behavior to auto for compatibility', () => {
    const element = document.createElement('p');
    const scrollIntoView = vi.spyOn(element, 'scrollIntoView').mockImplementation(() => {});

    scrollToElement(element, { enabled: true, offset: 80, behavior: 'instant' as const });

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'start',
      inline: 'nearest',
    });
    scrollIntoView.mockRestore();
  });
});
