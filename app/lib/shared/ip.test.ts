import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPublicIp } from "./ip.ts";

describe("isPublicIp", () => {
  it("acepta direcciones públicas IPv4 e IPv6", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "100.63.255.255", "100.128.0.1", "2606:4700:4700::1111", "2a00:1450:4001:81b::200e"]) {
      assert.equal(isPublicIp(ip), true, ip);
    }
  });

  it("bloquea loopback, redes privadas y la red local", () => {
    for (const ip of ["127.0.0.1", "127.255.255.254", "10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255", "192.168.0.1", "192.168.1.100", "0.0.0.0", "0.1.2.3"]) {
      assert.equal(isPublicIp(ip), false, ip);
    }
  });

  it("bloquea el servicio de metadatos de la nube y el enlace local", () => {
    for (const ip of ["169.254.169.254", "169.254.0.1", "fe80::1", "fe80::a00:27ff:fe4e:66a1"]) {
      assert.equal(isPublicIp(ip), false, ip);
    }
  });

  it("bloquea CGNAT, documentación, multicast y reservadas", () => {
    for (const ip of ["100.64.0.1", "100.127.255.255", "192.0.2.1", "198.51.100.7", "203.0.113.9", "198.18.0.1", "224.0.0.1", "239.255.255.255", "240.0.0.1", "255.255.255.255"]) {
      assert.equal(isPublicIp(ip), false, ip);
    }
  });

  it("bloquea IPv6 loopback, privada, multicast, documentación y las que incrustan un IPv4", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456:789a::1", "ff02::1", "2001:db8::1", "2001:0:4136:e378:8000:63bf:3fff:fdd2", "2002:c000:0204::1", "64:ff9b::7f00:1"]) {
      assert.equal(isPublicIp(ip), false, ip);
    }
  });

  it("no se deja engañar por IPv4 disfrazado de IPv6", () => {
    assert.equal(isPublicIp("::ffff:127.0.0.1"), false);
    assert.equal(isPublicIp("::ffff:10.0.0.1"), false);
    assert.equal(isPublicIp("::ffff:169.254.169.254"), false);
    assert.equal(isPublicIp("::ffff:7f00:1"), false);
    assert.equal(isPublicIp("::ffff:8.8.8.8"), true);
  });

  it("trata como no públicas las entradas que no son una IP válida", () => {
    for (const ip of ["", "localhost", "example.com", "256.1.1.1", "1.2.3", "1.2.3.4.5", "01.2.3.4x", "::g", "1:2:3:4:5:6:7:8:9", "fe80::1%eth0", "2606:4700::1111::1", "0x7f.0.0.1"]) {
      assert.equal(isPublicIp(ip), false, ip);
    }
  });
});
