/** موجة لمس واهتزاز خفيف لكل عنصر عليه الصنف btn. تُركَّب مرة واحدة عند بدء التطبيق. */
export function installRipple() {
  const reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(".btn");
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
      try {
        navigator.vibrate?.(8);
      } catch {
        /* غير مدعوم */
      }
      if (reduced) return;
      const r = el.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2;
      const span = document.createElement("span");
      span.className = "ripple";
      span.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      el.appendChild(span);
      setTimeout(() => span.remove(), 700);
    },
    { passive: true }
  );
}
