import { describe, it, expect } from 'vitest';
import {
	applyParagraphHighlight,
	clearParagraphHighlight,
	updateParagraphHighlightColor,
	highlightWordInBlock,
	clearWordHighlight,
	updateWordHighlightColor,
} from '@/lib/tts/speechHighlight';

describe('applyParagraphHighlight', () => {
	it('sets dynamic styles, Tailwind classes and an active marker', () => {
		const element = document.createElement('p');
		applyParagraphHighlight(element, { color: 'rgb(245, 214, 122)' });
		expect(element.style.backgroundColor).toBe('rgb(245, 214, 122)');
		expect(element.style.boxShadow).toBe('0 0 0 4px rgb(245, 214, 122)');
		expect(element.classList.contains('!rounded')).toBe(true);
		expect(element.classList.contains('!duration-150')).toBe(true);
		expect(element.getAttribute('data-tts-paragraph-active')).toBe('true');
	});
});

describe('clearParagraphHighlight', () => {
	it('removes dynamic styles, classes and the active marker', () => {
		const element = document.createElement('p');
		applyParagraphHighlight(element, { color: 'rgb(245, 214, 122)' });
		clearParagraphHighlight(element);
		expect(element.style.backgroundColor).toBe('');
		expect(element.style.boxShadow).toBe('');
		expect(element.classList.contains('!rounded')).toBe(false);
		expect(element.classList.contains('!duration-150')).toBe(false);
		expect(element.getAttribute('data-tts-paragraph-active')).toBeNull();
	});
});

describe('updateParagraphHighlightColor', () => {
	it('only updates color when the paragraph is currently highlighted', () => {
		const element = document.createElement('p');
		updateParagraphHighlightColor(element, 'rgb(0, 0, 0)');
		expect(element.style.backgroundColor).toBe('');

		applyParagraphHighlight(element, { color: 'rgb(245, 214, 122)' });
		updateParagraphHighlightColor(element, 'rgb(0, 0, 0)');
		expect(element.style.backgroundColor).toBe('rgb(0, 0, 0)');
		expect(element.style.boxShadow).toBe('0 0 0 4px rgb(0, 0, 0)');
	});
});

describe('highlightWordInBlock', () => {
	it('wraps the active word and preserves surrounding whitespace', () => {
		const element = document.createElement('p');
		element.innerHTML = '  Hello world.  ';
		const block = { element, text: element.textContent?.trim() ?? '' };
		const wrapper = highlightWordInBlock(block, 7, '#f59e0b');
		expect(wrapper).not.toBeNull();
		expect(wrapper?.textContent).toBe('world');
		expect(element.textContent).toBe('  Hello world.  ');
		expect(element.querySelector('span')).toBe(wrapper);
	});

	it('preserves inline formatting when the word is inside an element', () => {
		const element = document.createElement('p');
		element.innerHTML = 'Hello <em>world</em>!';
		const block = { element, text: element.textContent?.trim() ?? '' };
		const wrapper = highlightWordInBlock(block, 6, '#f59e0b');
		expect(wrapper).not.toBeNull();
		expect(element.textContent).toBe('Hello world!');
		expect(element.querySelector('em')).not.toBeNull();
		expect(element.querySelector('em span')).toBe(wrapper);
	});

	it('wraps a word that spans multiple inline elements', () => {
		const element = document.createElement('p');
		element.innerHTML = 'hello <em>won</em>derful world';
		const block = { element, text: element.textContent?.trim() ?? '' };
		const wrapper = highlightWordInBlock(block, 6, '#f59e0b');
		expect(wrapper).not.toBeNull();
		expect(wrapper?.textContent).toBe('wonderful');
		expect(element.textContent).toBe('hello wonderful world');
	});

	it('highlights the preceding word when the character index is on a word boundary', () => {
		const element = document.createElement('p');
		element.textContent = 'Hello world.';
		const block = { element, text: 'Hello world.' };
		const wrapper = highlightWordInBlock(block, 5, '#f59e0b');
		expect(wrapper).not.toBeNull();
		expect(wrapper?.textContent).toBe('Hello');
	});

	it('returns null for out-of-bounds character indices', () => {
		const element = document.createElement('p');
		element.textContent = 'Hello';
		const block = { element, text: 'Hello' };
		expect(highlightWordInBlock(block, -1, '#f59e0b')).toBeNull();
		expect(highlightWordInBlock(block, 10, '#f59e0b')).toBeNull();
	});
});

describe('clearWordHighlight', () => {
	it('unwraps the highlight span and restores the original DOM', () => {
		const element = document.createElement('p');
		element.innerHTML = '  Hello <em>world</em>!  ';
		const block = { element, text: element.textContent?.trim() ?? '' };
		const wrapper = highlightWordInBlock(block, 7, '#f59e0b');
		expect(wrapper).not.toBeNull();

		clearWordHighlight(wrapper!);

		expect(element.textContent).toBe('  Hello world!  ');
		expect(element.querySelector('span')).toBeNull();
		expect(element.querySelector('em')).not.toBeNull();
	});
});

describe('updateWordHighlightColor', () => {
	it('updates the word highlight background and contrast text color', () => {
		const element = document.createElement('p');
		element.textContent = 'Hello world';
		const block = { element, text: 'Hello world' };
		const wrapper = highlightWordInBlock(block, 6, '#f59e0b');
		expect(wrapper).not.toBeNull();

		updateWordHighlightColor(wrapper!, '#000000');

		expect(wrapper!.style.backgroundColor).toBe('rgb(0, 0, 0)');
		expect(wrapper!.style.color).toBe('rgb(255, 255, 255)');
	});
});
