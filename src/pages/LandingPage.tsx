import { useEffect, useRef } from "react";
import { startDemoSession } from "@/lib/demo/demoSession";

export default function LandingPage() {
  const landingFrame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleLandingMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== landingFrame.current?.contentWindow) return;
      if (event.data?.type !== "ewvon:start-demo") return;

      startDemoSession();
      window.location.assign("/");
    };

    window.addEventListener("message", handleLandingMessage);
    return () => window.removeEventListener("message", handleLandingMessage);
  }, []);

  return (
    <iframe
      ref={landingFrame}
      title="ewvon"
      src="/ewvon-landing.html"
      className="fixed inset-0 h-full w-full border-0"
      style={{ display: "block" }}
      allow="clipboard-write"
    />
  );
}
