import { useState, useEffect } from "react";

export const MIN_SIZE = 768;

export function ScreenGuard() {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MIN_SIZE}px)`);

    const evaluate = () => {
      setBlocked(mq.matches);
    };

    evaluate();
    mq.addEventListener("change", evaluate);
    return () => mq.removeEventListener("change", evaluate);
  }, []);

  if (!blocked) return null;

  return (
    <div
      style={{
        position: "fixed",
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.85)",
        color: "#fff",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "1.2rem",
        padding: "0 24px",
        textAlign: "center",
      }}
    >
      It is not yet recommended to use this application on mobile devices. Please, switch to a
      desktop web browser.
    </div>
  );
}
