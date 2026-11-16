import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { sceneForPath } from "../lib/scene-for-path";

// The three.js bundle is only downloaded in the browser, after the page is idle.
const Scene3D = lazy(() => import("./three/Scene3D"));

/**
 * Decorative, click-through 3D visual for the top of a page.
 * Picks a unique scene per page, pauses when off-screen, and stays light on phones.
 */
export default function Showcase3D({ path, variant, className = "" }) {
  const { settings } = useSettings();
  const enabled = settings.widgets?.bg_3d?.enabled !== false;
  const v = variant || sceneForPath(path);
  const wrap = useRef(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [go, setGo] = useState(false);
  const [visible, setVisible] = useState(true);
  const [low, setLow] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled || !v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canWebGL = (() => {
      try {
        const c = document.createElement("canvas");
        return !!(c.getContext("webgl2") || c.getContext("webgl"));
      } catch {
        return false;
      }
    })();
    if (!canWebGL) return;
    setLow(
      window.matchMedia("(max-width: 900px)").matches || (navigator.hardwareConcurrency || 8) <= 4,
    );
    const start = () => setGo(true);
    const id =
      "requestIdleCallback" in window
        ? window.requestIdleCallback(start, { timeout: 1500 })
        : setTimeout(start, 600);
    return () =>
      "cancelIdleCallback" in window ? window.cancelIdleCallback(id) : clearTimeout(id);
  }, [enabled, v]);

  useEffect(() => {
    if (!go) return;
    const onMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: "100px",
    });
    if (wrap.current) io.observe(wrap.current);
    return () => {
      window.removeEventListener("pointermove", onMove);
      io.disconnect();
    };
  }, [go]);

  if (!enabled || !v) return null;
  return (
    <div
      ref={wrap}
      aria-hidden="true"
      className={`showcase-3d showcase-3d--${v} ${ready ? "is-ready" : ""} ${className}`}
    >
      {go && (
        <Suspense fallback={null}>
          <Scene3D
            variant={v}
            pointer={pointer}
            active={visible}
            low={low}
            onReady={() => setReady(true)}
          />
        </Suspense>
      )}
    </div>
  );
}
