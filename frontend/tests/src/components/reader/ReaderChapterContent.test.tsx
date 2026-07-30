import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef, useState } from 'react';
import { ReaderChapterContent } from '@/components/reader/ReaderChapterContent';

const content = '<p>Hello world. Extra text.</p><p>Second paragraph.</p>';

describe('ReaderChapterContent dangerouslySetInnerHTML', () => {
  it('preserves manually-applied highlight attribute/style across re-renders with unchanged content', () => {
    const ref = createRef<HTMLDivElement>();
    const onClick = vi.fn();

    function Harness() {
      const [, setTick] = useState(0);
      // Expose a way to force a parent re-render (simulates useSyncExternalStore notify).
      (Harness as any).bump = () => setTick((t) => t + 1);
      return <ReaderChapterContent ref={ref} content={content} fontSize={18} onClick={onClick} />;
    }

    render(<Harness />);

    const firstP = ref.current!.querySelector('p')!;
    firstP.setAttribute('data-tts-paragraph-active', 'true');
    firstP.style.backgroundColor = 'rgb(219, 230, 255)';
    firstP.style.boxShadow = '0 0 0 4px rgb(219, 230, 255)';

    // Force a parent re-render with the SAME content string (new onClick identity, like ReaderView).
    act(() => {
      (Harness as any).bump();
    });

    const pAfter = ref.current!.querySelector('p')!;
    expect(pAfter.getAttribute('data-tts-paragraph-active')).toBe('true');
    expect(pAfter.style.backgroundColor).toBe('rgb(219, 230, 255)');
  });
});
