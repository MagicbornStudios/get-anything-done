"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface SpriteAnimationProps {
  src: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  fps?: number
  loop?: boolean
  direction?: "horizontal" | "vertical"
  className?: string
  style?: React.CSSProperties
  paused?: boolean
}

let injectedKeyframes = new Set<string>()

function ensureKeyframes(name: string, css: string) {
  if (typeof document === "undefined") return
  if (injectedKeyframes.has(name)) return
  injectedKeyframes.add(name)
  const style = document.createElement("style")
  style.textContent = css
  document.head.appendChild(style)
}

const SpriteAnimation = React.forwardRef<HTMLDivElement, SpriteAnimationProps>(
  (
    {
      src,
      frameWidth,
      frameHeight,
      frameCount,
      fps = 12,
      loop = true,
      direction = "horizontal",
      className,
      style,
      paused = false,
    },
    ref
  ) => {
    const isHorizontal = direction === "horizontal"
    const totalSize = isHorizontal
      ? frameWidth * frameCount
      : frameHeight * frameCount

    const keyframeName = `sprite-${isHorizontal ? "h" : "v"}-${totalSize}`
    const keyframeCss = isHorizontal
      ? `@keyframes ${keyframeName} { from { background-position-x: 0; } to { background-position-x: -${totalSize}px; } }`
      : `@keyframes ${keyframeName} { from { background-position-y: 0; } to { background-position-y: -${totalSize}px; } }`

    React.useEffect(() => {
      ensureKeyframes(keyframeName, keyframeCss)
    }, [keyframeName, keyframeCss])

    const duration = frameCount / fps

    return (
      <div
        ref={ref}
        data-cid="sprite-animation"
        className={cn(className)}
        style={{
          width: frameWidth,
          height: frameHeight,
          backgroundImage: `url(${src})`,
          backgroundRepeat: "no-repeat",
          animation: `${keyframeName} ${duration}s steps(${frameCount}) ${loop ? "infinite" : "forwards"}`,
          animationPlayState: paused ? "paused" : "running",
          ...style,
        }}
      />
    )
  }
)
SpriteAnimation.displayName = "SpriteAnimation"

export { SpriteAnimation }
