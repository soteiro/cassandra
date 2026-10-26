// Aplica la preferencia antes del primer render y sin esperar a Angular ni a la API.
(() => {
  let palette = 'amber';
  let mode = 'dark';
  try {
    const preference = JSON.parse(localStorage.getItem('cassandra.appearance') || 'null');
    if (['amber', 'ocean', 'forest', 'violet'].includes(preference?.palette)) palette = preference.palette;
    if (['dark', 'light', 'system'].includes(preference?.mode)) mode = preference.mode;
  } catch {
    // Sin almacenamiento, conserva la apariencia actual de Cassandra.
  }
  const dark = mode === 'dark' || (mode === 'system' && (!window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches));
  document.documentElement.dataset.palette = palette;
  document.documentElement.dataset.mode = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', dark ? 'dark' : 'light');
  document.addEventListener('DOMContentLoaded', () => {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--theme-browser-background').trim();
    if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }, { once: true });
})();
