export const ANIMATION = {
	spin: "animate-spin",
	pulse: "animate-pulse",
	bounce: "animate-bounce",
	ping: "animate-ping",
} as const;

export type AnimationName = keyof typeof ANIMATION;
