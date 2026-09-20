import http from 'node:http';

const response = http.ServerResponse.prototype;
const originalRemoveHeader = response.removeHeader;
const originalSetHeader = response.setHeader;
const originalWriteHead = response.writeHead;

response.removeHeader = function safeRemoveHeader(name) {
  if (this.headersSent) return;
  return originalRemoveHeader.call(this, name);
};

response.setHeader = function safeSetHeader(name, value) {
  if (this.headersSent) return this;
  return originalSetHeader.call(this, name, value);
};

response.writeHead = function safeWriteHead(statusCode, statusMessage, headers) {
  let reason = statusMessage;
  let headerObject = headers;
  if (reason && typeof reason === 'object') {
    headerObject = reason;
    reason = undefined;
  }

  if (headerObject && typeof headerObject === 'object' && !Array.isArray(headerObject)) {
    headerObject = { ...headerObject };
    const contentTypeKey = Object.keys(headerObject).find((key) => key.toLowerCase() === 'content-type');
    const contentType = String(contentTypeKey ? headerObject[contentTypeKey] : this.getHeader('content-type') || '');
    if (contentType.includes('text/html') || contentType.includes('text/css')) {
      for (const key of Object.keys(headerObject)) {
        if (key.toLowerCase() === 'content-length') delete headerObject[key];
      }
      const cacheKey = Object.keys(headerObject).find((key) => key.toLowerCase() === 'cache-control');
      if (cacheKey) headerObject[cacheKey] = 'no-store, max-age=0';
      else headerObject['Cache-Control'] = 'no-store, max-age=0';
    }
  }

  if (reason === undefined) return originalWriteHead.call(this, statusCode, headerObject);
  return originalWriteHead.call(this, statusCode, reason, headerObject);
};

await import('./wrapper-core.mjs');
