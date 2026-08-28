import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const autoScrollDoneRef = React.useRef(false);
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

    const scrollToEndAfterLayout = () => {
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);

      const settle = () => {
        const messageNodes = viewport.querySelectorAll('[id^="msg-"]');
        if (!messageNodes.length || autoScrollDoneRef.current) return;

        // Wait for React layout and media dimensions to settle before choosing
        // the initial position. This prevents the chat from stopping a few
        // pixels short when message content grows after the first paint.
        viewport.scrollTop = viewport.scrollHeight;
        window.requestAnimationFrame(() => {
          viewport.scrollTop = viewport.scrollHeight;
          autoScrollDoneRef.current = true;
        });
      };

      settleTimerRef.current = window.setTimeout(settle, 0);
    };

    const mutationObserver = new MutationObserver(() => {
      const hasMessages = viewport.querySelector('[id^="msg-"]') !== null;
      if (!hasMessages) {
        autoScrollDoneRef.current = false;
        return;
      }
      scrollToEndAfterLayout();
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!autoScrollDoneRef.current) scrollToEndAfterLayout();
    });

    mutationObserver.observe(viewport, { childList: true, subtree: true });
    resizeObserver.observe(viewport);

    scrollToEndAfterLayout();

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
