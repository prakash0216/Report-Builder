const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Proxies /api requests from the dev server (e.g. port 8080) to the backend (port 3002).
 * Use empty REACT_APP_API_BASE_URL in .env.development so requests go to same origin and get proxied.
 * Uses 127.0.0.1 to avoid Windows IPv6 localhost issues that can cause 502.
 */
module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:3002',
      changeOrigin: true,
      secure: false,
      proxyTimeout: 60000,
      timeout: 60000,
      onError: (err, req, res) => {
        console.error('[proxy] /api -> 127.0.0.1:3002 error:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Proxy error: ' + err.message }));
      },
    })
  );
};
