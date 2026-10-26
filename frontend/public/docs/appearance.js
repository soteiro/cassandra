// La referencia independiente también respeta el modo guardado en este dispositivo.
(() => {
  const reference = document.getElementById('api-reference');
  const configuration = JSON.parse(reference.dataset.configuration);
  configuration.darkMode = document.documentElement.dataset.mode !== 'light';
  reference.dataset.configuration = JSON.stringify(configuration);
})();
