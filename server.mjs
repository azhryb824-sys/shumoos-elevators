import http from 'node:http';

const originalRemoveHeader = http.ServerResponse.prototype.removeHeader;
const originalSetHeader = http.ServerResponse.prototype.setHeader;

http.ServerResponse.prototype.removeHeader = function safeRemoveHeader(name) {
  if (this.headersSent) return;
  return originalRemoveHeader.call(this, name);
};

http.ServerResponse.prototype.setHeader = function safeSetHeader(name, value) {
  if (this.headersSent) return this;
  return originalSetHeader.call(this, name, value);
};

await import('./wrapper-core.mjs');
