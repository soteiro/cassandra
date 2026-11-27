import { cargarApi } from './demo.interceptor';

/**
 * Aviso fijo de la demo con el botón para restablecer los datos. Es DOM plano a propósito:
 * vive fuera de la app para no tocar el layout real.
 */
export function montarAvisoDemo(): void {
  if (document.getElementById('demo-aviso')) return;

  const estilo = document.createElement('style');
  estilo.textContent = `
    #demo-aviso {
      position: fixed; z-index: 60; right: 1rem;
      bottom: calc(5rem + env(safe-area-inset-bottom));
      display: flex; align-items: center; gap: .5rem;
      max-width: calc(100vw - 2rem);
      padding: .4rem .5rem .4rem .8rem; border-radius: 999px;
      font: 500 12px/1.3 system-ui, sans-serif;
      color: var(--color-text-main, #e6e6e6);
      background: var(--color-surface, #1c1c1f);
      border: 1px solid var(--color-surface-border, #3a3a40);
      box-shadow: 0 6px 24px rgb(0 0 0 / .25);
    }
    @media (min-width: 768px) { #demo-aviso { bottom: 1rem; } }
    @media (max-width: 480px) { #demo-aviso .demo-extra { display: none; } }
    #demo-aviso strong { color: var(--color-primary-text, inherit); }
    #demo-aviso button {
      font: inherit; cursor: pointer; padding: .3rem .7rem; border-radius: 999px;
      color: inherit; background: transparent;
      border: 1px solid var(--color-surface-border, #3a3a40);
    }
    #demo-aviso button:hover { background: var(--color-surface-border, #3a3a40); }
    #demo-aviso button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  `;
  document.head.append(estilo);

  const aviso = document.createElement('aside');
  aviso.id = 'demo-aviso';
  aviso.setAttribute('aria-label', 'Aviso de demo');

  const texto = document.createElement('span');
  texto.innerHTML =
    '<strong>Demo</strong> · datos ficticios<span class="demo-extra">, guardados solo en tu navegador</span>';

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.textContent = 'Restablecer';
  boton.title = 'Volver a los datos de ejemplo';
  boton.addEventListener('click', async () => {
    if (confirm('¿Volver a los datos de ejemplo? Se perderán los cambios que hiciste.')) {
      const { restablecer } = await cargarApi();
      restablecer();
      window.location.reload();
    }
  });

  aviso.append(texto, boton);
  document.body.append(aviso);
}
