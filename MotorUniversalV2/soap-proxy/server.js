/**
 * SOAP Reverse Proxy — evaluasoap1.azurewebsites.net
 * 
 * Forwards all requests to the MotorV2 Container App's SOAP compat layer.
 * Used by hex-edited VB6 EXEs that point to this domain instead of legacy.
 * 
 * Legacy servers are NOT touched — this is a completely separate service.
 */

const http = require('http');
const https = require('https');
const url = require('url');

// Target: MotorV2 Container App (PROD)
const TARGET_HOST = process.env.TARGET_HOST
  || 'evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io';
const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  // Build target URL preserving the original path
  const targetPath = req.url || '/';

  const options = {
    hostname: TARGET_HOST,
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: TARGET_HOST,
      'x-forwarded-host': req.headers.host || '',
      'x-forwarded-proto': 'https',
    },
    // Don't reject self-signed certs in Azure internal network
    rejectUnauthorized: true,
  };

  // Remove connection-specific headers
  delete options.headers['connection'];
  delete options.headers['upgrade'];

  const proxyReq = https.request(options, (proxyRes) => {
    // Copy response headers, removing transfer-encoding for safety
    const headers = { ...proxyRes.headers };
    delete headers['transfer-encoding'];

    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error(`Proxy error: ${err.message} → ${TARGET_HOST}${targetPath}`);
    res.writeHead(502, { 'Content-Type': 'text/xml; charset=utf-8' });
    res.end(
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
      `<soap:Body><soap:Fault>` +
      `<faultcode>soap:Server</faultcode>` +
      `<faultstring>Proxy Error: ${err.message}</faultstring>` +
      `</soap:Fault></soap:Body></soap:Envelope>`
    );
  });

  // Timeout after 30 seconds
  proxyReq.setTimeout(30000, () => {
    proxyReq.destroy(new Error('Request timeout'));
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(PORT, () => {
  console.log(`SOAP Proxy listening on port ${PORT}`);
  console.log(`Forwarding to: https://${TARGET_HOST}`);
});
