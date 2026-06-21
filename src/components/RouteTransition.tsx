import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

/**
 * Subtle fade/slide between route changes. Pure CSS, no extra deps.
 */
export default function RouteTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [stage, setStage] = useState<"in" | "out">("in");

  useEffect(() => {
    setStage("out");
    const t = window.setTimeout(() => setStage("in"), 20);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return (
    <div
      key={pathname}
      className={
        "transition-all duration-300 ease-out will-change-[opacity,transform] " +
        (stage === "in"
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-1")
      }
    >
      {children}
    </div>
  );
}
