import * as React from "react";

const MOBILE_BREAKPOINT = 768;

// Get mobile state synchronously from window
function getSnapshot(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

// Server-side fallback - default to mobile to prevent flash
function getServerSnapshot(): boolean {
  return false;
}

// Subscribe to window resize events
function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  
  const handleChange = () => {
    callback();
  };
  
  mql.addEventListener("change", handleChange);
  window.addEventListener("resize", handleChange);
  
  return () => {
    mql.removeEventListener("change", handleChange);
    window.removeEventListener("resize", handleChange);
  };
}

export function useIsMobile(): boolean {
  // useSyncExternalStore ensures the value is read synchronously
  const isMobile = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  return isMobile;
}
