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

      // Force the viewport to the actual current end. This is intentionally
      // done without smooth scrolling while the initial message layout is
      // settling, so late-loading media cannot leave a small gap at the bottom.
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

    const mutationObserver = new MutationObserver(() => {
      const hasMessages = viewport.querySelector('[id^="msg-"]') !== null;
      if (!hasMessages) {
        autoScrollDoneRef.current = false;
        settleUntilRef.current = 0;
        return;
      }
      if (!autoScrollDoneRef.current) beginInitialScroll();
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!autoScrollDoneRef.current) keepAtEndWhileSettling();
    });

    mutationObserver.observe(viewport, { childList: true, subtree: true });
    resizeObserver.observe(viewport);

    beginInitialScroll();

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
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
      "flex touch-none select-none transition-colors",
      orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
