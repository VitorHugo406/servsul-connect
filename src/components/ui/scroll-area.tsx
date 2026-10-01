import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const autoScrollDoneRef = React.useRef(false);
  const settleUntilRef = React.useRef(0);
  const settleTimerRef = React.useRef<number | null>(null);

  const setRefs = React.useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const viewport = root.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
    if (!viewport) return;

    const keepAtEndWhileSettling = () => {
      if (userTookOver) return;
      const messageNodes = viewport.querySelectorAll('[id^="msg-"]');
      if (!messageNodes.length) return;

      const now = performance.now();
      if (!settleUntilRef.current) settleUntilRef.current = now + 1200;
      if (now >= settleUntilRef.current) {
        viewport.scrollTop = viewport.scrollHeight;
        autoScrollDoneRef.current = true;
        settleUntilRef.current = 0;
        return;
      }

      viewport.scrollTop = viewport.scrollHeight;
      autoScrollDoneRef.current = false;

      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = window.setTimeout(() => {
        window.requestAnimationFrame(keepAtEndWhileSettling);
      }, 32);
    };

    const beginInitialScroll = () => {
      autoScrollDoneRef.current = false;
      settleUntilRef.current = performance.now() + 1200;
      keepAtEndWhileSettling();
    };

    // As soon as the user touches/scrolls, stop pinning to the bottom for good
    // (until the message list is replaced, e.g. switching chats).
    let userTookOver = false;
    const takeOver = () => {
      userTookOver = true;
      autoScrollDoneRef.current = true;
      settleUntilRef.current = 0;
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    };

    const mutationObserver = new MutationObserver(() => {
      const hasMessages = viewport.querySelector('[id^="msg-"]') !== null;
      if (!hasMessages) {
        userTookOver = false;
        autoScrollDoneRef.current = false;
        settleUntilRef.current = 0;
        return;
      }
      if (!autoScrollDoneRef.current && !userTookOver) beginInitialScroll();
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!autoScrollDoneRef.current && !userTookOver) keepAtEndWhileSettling();
    });

    viewport.addEventListener("touchstart", takeOver, { passive: true });
    viewport.addEventListener("wheel", takeOver, { passive: true });
    viewport.addEventListener("pointerdown", takeOver, { passive: true });
    mutationObserver.observe(viewport, { childList: true, subtree: true });
    resizeObserver.observe(viewport);
    beginInitialScroll();

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      viewport.removeEventListener("touchstart", takeOver);
      viewport.removeEventListener("wheel", takeOver);
      viewport.removeEventListener("pointerdown", takeOver);
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    };
  }, []);

  return (
    <ScrollAreaPrimitive.Root ref={setRefs} className={cn("relative overflow-hidden", className)} {...props}>
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">{children}</ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors bg-transparent",
      orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-0",
      orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-0",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-transparent opacity-0" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
