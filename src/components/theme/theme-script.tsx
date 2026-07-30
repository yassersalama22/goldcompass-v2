/**
 * Applies the stored theme before first paint, so a dark-mode visitor never
 * sees a white flash. This has to be a blocking inline script: any deferred
 * or React-driven approach runs after the first paint, which is the flash.
 *
 * Allowed by our CSP because `script-src` includes `'unsafe-inline'` (see
 * next.config.ts). Keep it dependency-free and tiny — it is on every page and
 * blocks rendering.
 *
 * This mutates <html> before hydration, so the root element genuinely differs
 * from the server output — `<html suppressHydrationWarning>` in the layout
 * covers exactly that one element. Nothing below it is affected: the toggle
 * renders both icons and swaps them in CSS, so no descendant's markup depends
 * on the theme.
 */
export const THEME_STORAGE_KEY = "gc-theme";

const script = `
(function(){
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var dark = stored
      ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    var root = document.documentElement;
    root.classList.toggle('dark', dark);
    // Tells the browser which palette to use for form controls and scrollbars.
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`.trim();

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
