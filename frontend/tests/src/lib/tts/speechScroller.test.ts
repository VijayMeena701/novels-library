import { vi, describe, it, expect } from 'vitest';
import { scrollToElement } from '@/lib/tts/speechScroller';

describe('scrollToElement', () => {
	it('does nothing when scrolling is disabled', () => {
		const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
		const element = document.createElement('p');
		scrollToElement(element, { enabled: false, offset: 100, behavior: 'smooth' });
		expect(scrollTo).not.toHaveBeenCalled();
		scrollTo.mockRestore();
	});

	it('scrolls the window when the element has no scrollable parent', () => {
		const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
		const element = document.createElement('p');
		Object.defineProperty(element, 'getBoundingClientRect', {
			value: () => ({ top: 500 }),
		});
		Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });

		scrollToElement(element, { enabled: true, offset: 140, behavior: 'smooth' });

		expect(scrollTo).toHaveBeenCalledWith({ top: 460, behavior: 'smooth' });
		scrollTo.mockRestore();
	});

	it('scrolls the closest scrollable parent element', () => {
		const parent = document.createElement('div');
		parent.style.overflow = 'auto';
		const element = document.createElement('p');
		parent.appendChild(element);
		document.body.appendChild(parent);

		Object.defineProperty(element, 'getBoundingClientRect', {
			value: () => ({ top: 200 }),
		});
		Object.defineProperty(parent, 'getBoundingClientRect', {
			value: () => ({ top: 50 }),
		});
		Object.defineProperty(parent, 'scrollTop', { value: 10, configurable: true });
		const scrollTo = vi.fn();
		Object.defineProperty(parent, 'scrollTo', { value: scrollTo, configurable: true });

		scrollToElement(element, { enabled: true, offset: 80, behavior: 'auto' });

		expect(scrollTo).toHaveBeenCalledWith({ top: 80, behavior: 'auto' });

		document.body.removeChild(parent);
	});
});
