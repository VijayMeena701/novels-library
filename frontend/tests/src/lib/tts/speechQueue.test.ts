import { describe, it, expect } from 'vitest';
import type { PronunciationRule } from '@/utils/api';
import {
  findSpeechBlocks,
  splitSpeechTextWithOffsets,
  applyPronunciationRules,
  createSpeechQueue,
} from '@/lib/tts/speechQueue';

function makeRule(
  overrides: Partial<PronunciationRule> & { pattern: string; replacement: string },
): PronunciationRule {
  return {
    _id: 'test',
    userId: 'test',
    isGlobal: true,
    wholeWord: false,
    caseSensitive: false,
    enabled: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('findSpeechBlocks', () => {
  it('returns leaf content blocks and ignores nested containers', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>First paragraph.</p><div><p>Nested paragraph.</p></div><p>   </p><span>Not a block</span>';
    const blocks = findSpeechBlocks(root);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe('First paragraph.');
    expect(blocks[1].text).toBe('Nested paragraph.');
  });

  it('returns empty array for null root', () => {
    expect(findSpeechBlocks(null)).toEqual([]);
  });

  it('treats li and blockquote as blocks', () => {
    const root = document.createElement('div');
    root.innerHTML = '<li>Item</li><blockquote>Quote</blockquote>';
    const blocks = findSpeechBlocks(root);
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.text)).toEqual(['Item', 'Quote']);
  });
});

describe('splitSpeechTextWithOffsets', () => {
  it('returns empty array for empty or whitespace-only text', () => {
    expect(splitSpeechTextWithOffsets('')).toEqual([]);
    expect(splitSpeechTextWithOffsets('   \n\t  ')).toEqual([]);
  });

  it('returns a single chunk for short text with offset 0', () => {
    const chunks = splitSpeechTextWithOffsets('Hello world.');
    expect(chunks).toEqual([{ text: 'Hello world.', startOffset: 0 }]);
  });

  it('splits long repetitive text at punctuation', () => {
    const text = 'A. '.repeat(1000);
    const chunks = splitSpeechTextWithOffsets(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[1].startOffset).toBe(chunks[0].text.length + 1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(1800);
    }
  });

  it('falls back to a word break when there is no punctuation', () => {
    const words = Array(500).fill('word').join(' ');
    const chunks = splitSpeechTextWithOffsets(words);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(1800);
    }
  });

  it('normalizes whitespace and computes offsets against the normalized string', () => {
    const chunks = splitSpeechTextWithOffsets('One    two  three');
    expect(chunks).toEqual([{ text: 'One two three', startOffset: 0 }]);
  });

  it('returns a chunk that reaches the end of the input', () => {
    const text = 'A. '.repeat(700);
    const chunks = splitSpeechTextWithOffsets(text);
    const last = chunks[chunks.length - 1];
    const normalized = text.replace(/\s+/g, ' ').trim();
    expect(normalized.endsWith(last.text)).toBe(true);
  });
});

describe('applyPronunciationRules', () => {
  it('returns text unchanged when there are no rules', () => {
    expect(applyPronunciationRules('hello world', [])).toBe('hello world');
  });

  it('applies a simple replacement', () => {
    const rules = [makeRule({ pattern: 'world', replacement: 'everyone' })];
    expect(applyPronunciationRules('hello world', rules)).toBe('hello everyone');
  });

  it('applies a whole-word replacement', () => {
    const rules = [makeRule({ pattern: 'world', replacement: 'everyone', wholeWord: true })];
    expect(applyPronunciationRules('hello worldly world', rules)).toBe('hello worldly everyone');
  });

  it('applies a case-sensitive replacement', () => {
    const rules = [makeRule({ pattern: 'World', replacement: 'Everyone', caseSensitive: true })];
    expect(applyPronunciationRules('hello World and world', rules)).toBe('hello Everyone and world');
  });

  it('mutes/sips text when the replacement is empty', () => {
    const rules = [makeRule({ pattern: 'world', replacement: '' })];
    expect(applyPronunciationRules('hello world there', rules)).toBe('hello there');
  });

  it('ignores disabled rules', () => {
    const rules = [makeRule({ pattern: 'world', replacement: 'everyone', enabled: false })];
    expect(applyPronunciationRules('hello world', rules)).toBe('hello world');
  });

  it('escapes regex metacharacters when applying rules', () => {
    const rules = [makeRule({ pattern: '(', replacement: 'x' })];
    expect(applyPronunciationRules('hello (world', rules)).toBe('hello xworld');
  });

  it('normalizes whitespace after replacements', () => {
    const rules = [makeRule({ pattern: 'world', replacement: '  everyone  ' })];
    expect(applyPronunciationRules('hello world', rules)).toBe('hello everyone');
  });
});

describe('createSpeechQueue', () => {
  function makeBlock(text: string) {
    const element = document.createElement('p');
    element.textContent = text;
    return { element, text };
  }

  it('creates a queue of items from all blocks starting at index 0', () => {
    const blocks = [makeBlock('First.'), makeBlock('Second.')];
    const queue = createSpeechQueue(blocks, 0, []);
    expect(queue.length).toBe(2);
    expect(queue[0].blockIndex).toBe(0);
    expect(queue[1].blockIndex).toBe(1);
    expect(queue[0].text).toBe('First.');
    expect(queue[1].text).toBe('Second.');
  });

  it('respects the starting block index', () => {
    const blocks = [makeBlock('First.'), makeBlock('Second.')];
    const queue = createSpeechQueue(blocks, 1, []);
    expect(queue.length).toBe(1);
    expect(queue[0].blockIndex).toBe(1);
    expect(queue[0].text).toBe('Second.');
  });

  it('applies pronunciation rules to spokenText while keeping text unchanged', () => {
    const blocks = [makeBlock('hello world')];
    const rules = [makeRule({ pattern: 'world', replacement: 'everyone' })];
    const queue = createSpeechQueue(blocks, 0, rules);
    expect(queue).toHaveLength(1);
    expect(queue[0].text).toBe('hello world');
    expect(queue[0].spokenText).toBe('hello everyone');
    expect(queue[0].startOffset).toBe(0);
  });

  it('splits long blocks into multiple queue items with the same blockIndex', () => {
    const text = Array(500).fill('word').join(' ');
    const blocks = [makeBlock(text)];
    const queue = createSpeechQueue(blocks, 0, []);
    expect(queue.length).toBeGreaterThan(1);
    for (const item of queue) {
      expect(item.blockIndex).toBe(0);
      expect(item.text.length).toBeLessThanOrEqual(1800);
    }
  });

  it('returns an empty queue for an empty block list', () => {
    expect(createSpeechQueue([], 0, [])).toEqual([]);
  });
});
