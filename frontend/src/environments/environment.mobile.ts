export const environment = {
  production: true,
  // Sin servidor de fábrica: la app pide el suyo al iniciar (ServerConfigService).
  apiUrl: '',
  isMobile: true,
  // Última release publicada (botón "Buscar actualizaciones" de la app Android).
  releasesApiUrl: 'https://api.github.com/repos/soteiro/cassandra/releases/latest'
};