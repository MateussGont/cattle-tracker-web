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
await assert.rejects(handshake(host, { ca: [] }), error => ['UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN'].includes(error.code));
await assert.rejects(handshake(host, { minVersion: 'TLSv1.1', maxVersion: 'TLSv1.1', ciphers: 'DEFAULT:@SECLEVEL=0' }));
await new Promise((resolve, reject) => {
  const socket = net.connect({ host, port: 8883 });
  socket.setTimeout(3000, () => { socket.destroy(); resolve(); });
  socket.once('error', resolve);
  socket.once('close', resolve);
  socket.once('connect', () => socket.write(Buffer.from('101600044d5154540402003c000a746c732d70726f626531', 'hex')));
  socket.once('data', data => {
    socket.destroy();
    if (data[0] === 0x20) reject(Error('Listener aceitou MQTT sem TLS.'));
    else resolve();
  });
});
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
console.log('TLS1.2/1.3 válidos; TLS1.1, CA/nome errados, MQTT sem TLS e anônimo recusados; 1883 não acessível.');
