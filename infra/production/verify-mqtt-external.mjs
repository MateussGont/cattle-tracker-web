// Sem credenciais: certificado, TLS e rejeição anônima a partir de outra máquina.
import assert from 'node:assert/strict';
import tls from 'node:tls';
import net from 'node:net';
const host = process.argv[2] ?? 'cattletracker.tech';
function handshake(servername, extra = {}) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: 8883, servername, rejectUnauthorized: true, minVersion: 'TLSv1.2', ...extra });
    socket.setTimeout(6000, () => socket.destroy(Error('Timeout')));
    socket.once('error', reject);
    socket.once('secureConnect', () => {
      const result = { protocol: socket.getProtocol(), expires: socket.getPeerCertificate().valid_to };
      socket.end(); resolve(result);
    });
  });
}
console.log(await handshake(host, { maxVersion: 'TLSv1.2' }));
console.log(await handshake(host, { minVersion: 'TLSv1.3' }));
await assert.rejects(handshake('invalid.example.test'), error => error.code === 'ERR_TLS_CERT_ALTNAME_INVALID');
await new Promise((resolve, reject) => {
  const socket = tls.connect({ host, port: 8883, servername: host, rejectUnauthorized: true });
  socket.setTimeout(6000, () => socket.destroy(Error('Timeout')));
  socket.on('error', reject);
  socket.on('secureConnect', () => socket.write(Buffer.from('101600044d5154540402003c000a746c732d70726f626531', 'hex')));
  let response = Buffer.alloc(0);
  socket.on('data', data => {
    response = Buffer.concat([response, data]);
    if (response.length >= 4) {
      try { assert.equal(response.subarray(0, 4).toString('hex'), '20020005'); socket.end(); resolve(); }
      catch (error) { socket.destroy(); reject(error); }
    }
  });
});
await new Promise((resolve, reject) => {
  const socket = net.connect({ host, port: 1883 });
  socket.setTimeout(2500, () => { socket.destroy(); resolve(); });
  socket.once('error', resolve);
  socket.once('connect', () => { socket.destroy(); reject(Error('1883 acessível externamente.')); });
});
console.log('Certificado e hostname válidos; nome errado e MQTT anônimo recusados; 1883 não acessível.');
