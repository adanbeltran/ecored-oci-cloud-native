// Vite usa este objeto vacío en local y recurre a frontend/.env.
// En Docker, el script de inicio reemplaza el archivo antes de abrir Nginx.
window.__ECORED_CONFIG__ = Object.freeze({});
