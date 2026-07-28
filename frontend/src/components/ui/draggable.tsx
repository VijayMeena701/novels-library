'use client';

import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { useDrag } from '@use-gesture/react';
import type { FullGestureState } from '@use-gesture/core/types';
import { cn } from '../../lib/utils';

const DEFAULT_PADDING = 8;
const DRAG_THRESHOLD = 4;

interface Size {
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampDraggablePosition(
  position: { x: number; y: number },
  size: Size,
  padding = DEFAULT_PADDING,
): { x: number; y: number } {
  if (typeof window === 'undefined') return position;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxX = Math.max(padding, viewportWidth - size.width - padding);
  const maxY = Math.max(padding, viewportHeight - size.height - padding);
  return {
    x: Math.round(clamp(position.x, padding, maxX)),
    y: Math.round(clamp(position.y, padding, maxY)),
  };
}

export interface DraggableProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  'onClick' | 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'style'
> {
  as?: 'div' | 'button';
  position: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }, options?: { immediate?: boolean }) => void;
  onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
  handle?: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Draggable({
  as = 'div',
  position,
  onPositionChange,
  onClick,
  handle,
  disabled,
  children,
  className,
  style,
  ...rest
}: DraggableProps) {
  const isButton = as === 'button';
  const containerRef = useRef<HTMLElement | null>(null);
  const positionRef = useRef(position);
  const originRef = useRef(position);
  const onPositionChangeRef = useRef(onPositionChange);
  const sizeRef = useRef<Size>({ width: 0, height: 0 });
  const didDragRef = useRef(false);
  const originalTransitionRef = useRef<string>('');
  const transitionDisabledRef = useRef(false);

  useEffect(() => {
    positionRef.current = position;
    originRef.current = position;
  }, [position]);

  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  useEffect(() => {
    const container = containerRef.current;
    return () => {
      if (container && transitionDisabledRef.current) {
        container.style.transform = '';
        container.style.cursor = '';
        container.style.transition = originalTransitionRef.current;
      }
    };
  }, []);

  const bind = useDrag(
    (state: FullGestureState<'drag'>) => {
      const container = containerRef.current;
      if (!container) return;

      if (state.first && handle) {
        const target = state.event.target;
        if (target instanceof Element && !target.closest(handle)) {
          state.cancel();
          return;
        }
      }

      if (state.first) {
        originRef.current = { x: positionRef.current.x, y: positionRef.current.y };
        didDragRef.current = false;
        originalTransitionRef.current = container.style.transition;
        transitionDisabledRef.current = true;
        container.style.transition = 'none';

        const rect = container.getBoundingClientRect();
        sizeRef.current = { width: rect.width, height: rect.height };
      }

      if (state.active && state.intentional) {
        didDragRef.current = true;
        container.style.cursor = 'grabbing';

        const next = clampDraggablePosition(
          { x: originRef.current.x + state.movement[0], y: originRef.current.y + state.movement[1] },
          sizeRef.current,
        );

        const translateX = next.x - originRef.current.x;
        const translateY = next.y - originRef.current.y;
        container.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
      }

      if (state.last || state.canceled) {
        if (transitionDisabledRef.current) {
          transitionDisabledRef.current = false;
          container.style.transition = 'none';
          container.style.transform = '';
          container.style.cursor = '';

          if (didDragRef.current) {
            const next = clampDraggablePosition(
              { x: originRef.current.x + state.movement[0], y: originRef.current.y + state.movement[1] },
              sizeRef.current,
            );

            container.style.left = `${next.x}px`;
            container.style.top = `${next.y}px`;
            onPositionChangeRef.current(next, { immediate: true });
          }

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (containerRef.current) {
                containerRef.current.style.transition = originalTransitionRef.current;
              }
            });
          });
        }
      }
    },
    {
      threshold: DRAG_THRESHOLD,
      triggerAllEvents: true,
      enabled: !disabled,
      pointer: { capture: true, keys: false },
      preventDefault: false,
    },
  );

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (didDragRef.current) {
        event.preventDefault();
        event.stopPropagation();
        didDragRef.current = false;
        return;
      }
      if (onClick) {
        onClick(event);
      }
    },
    [onClick],
  );

  const Tag = (isButton ? 'button' : 'div') as 'button' | 'div';

  return (
    <Tag
      ref={containerRef as React.Ref<HTMLButtonElement & HTMLDivElement>}
      type={isButton ? 'button' : undefined}
      {...rest}
      {...bind()}
      onClick={handleClick}
      className={cn('fixed z-[51]', !handle && 'touch-none', className)}
      style={{ left: position.x, top: position.y, ...style }}
    >
      {children}
    </Tag>
  );
}
