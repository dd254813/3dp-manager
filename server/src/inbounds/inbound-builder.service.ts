import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InboundBuilderService {
  private readonly flag = process.env.COUNTRY_FLAG ?? '%F0%9F%92%AF';

  buildVlessRealityTcp(params: { port: number; uuid: string; domain: string; privateKey: string; publicKey: string }) {
    const { port, uuid, domain, privateKey, publicKey } = params;
    return {
      enable: true,
      port,
      protocol: 'vless',
      remark: `vless-tcp-reality`,
      settings: JSON.stringify({
        clients: [{ id: uuid, flow: 'xtls-rprx-vision', email: uuid, enable: true, limitIp: 0, totalGB: 0, expiryTime: 0, tgId: '', subId: '', reset: 0 }],
        decryption: 'none',
        encryption: 'none',
        fallbacks: []
      }),
      streamSettings: JSON.stringify({
        network: 'tcp',
        security: 'reality',
        externalProxy: [],
        realitySettings: {
          show: false,
          xver: 0,
          target: `${domain}:443`,
          dest: `${domain}:443`,
          serverNames: [domain],
          privateKey: privateKey,
          shortIds: [crypto.randomBytes(4).toString('hex'), crypto.randomBytes(4).toString('hex')],
          settings: { publicKey: publicKey, fingerprint: 'random', serverName: '', spiderX: '/' }
        },
        tcpSettings: { acceptProxyProtocol: false, header: { type: 'none' } }
      }),
      sniffing: JSON.stringify({ enabled: true, destOverride: ['http', 'tls', 'quic', 'fakedns'], metadataOnly: false, routeOnly: false })
    };
  }

  buildVlessRealityXhttp(params: { port: number; uuid: string; domain: string; privateKey: string; publicKey: string }) {
    const { port, uuid, domain, privateKey, publicKey } = params;
    return {
      enable: true,
      port,
      protocol: 'vless',
      remark: `vless-xhttp-reality`,
      settings: JSON.stringify({
        clients: [{ id: uuid, flow: 'xtls-rprx-vision', email: uuid, enable: true, limitIp: 0, totalGB: 0, expiryTime: 0, tgId: '', subId: '', reset: 0 }],
        decryption: 'none',
        encryption: 'none',
        fallbacks: []
      }),
      streamSettings: JSON.stringify({
        network: 'xhttp',
        security: 'reality',
        externalProxy: [],
        realitySettings: {
          show: false,
          xver: 0,
          target: `${domain}:443`,
          dest: `${domain}:443`,
          serverNames: [domain],
          privateKey: privateKey,
          shortIds: [crypto.randomBytes(4).toString('hex'), crypto.randomBytes(4).toString('hex')],
          settings: { publicKey: publicKey, fingerprint: 'random', serverName: '', spiderX: '/' }
        },
        xhttpSettings: { path: '/', mode: 'auto' }
      }),
      sniffing: JSON.stringify({ enabled: true, destOverride: ['http', 'tls', 'quic', 'fakedns'], metadataOnly: false, routeOnly: false })
    };
  }

  buildVlessRealityGrpc(params: { port: number; uuid: string; domain: string; privateKey: string; publicKey: string }) {
    const { port, uuid, domain, privateKey, publicKey } = params;
    return {
      enable: true,
      port,
      protocol: 'vless',
      remark: `vless-grpc-reality`,
      settings: JSON.stringify({
        clients: [{ id: uuid, flow: '', email: uuid, enable: true, limitIp: 0, totalGB: 0, expiryTime: 0, tgId: '', subId: '', reset: 0 }],
        decryption: 'none',
        encryption: 'none',
        fallbacks: []
      }),
      streamSettings: JSON.stringify({
        network: 'grpc',
        security: 'reality',
        externalProxy: [],
        realitySettings: {
          show: false,
          xver: 0,
          target: `${domain}:443`,
          dest: `${domain}:443`,
          serverNames: [domain],
          privateKey: privateKey,
          shortIds: [crypto.randomBytes(4).toString('hex')],
          settings: { publicKey: publicKey, fingerprint: 'random', serverName: '', spiderX: '/' }
        },
        grpcSettings: { serviceName: 'grpc', multiMode: false }
      }),
      sniffing: JSON.stringify({ enabled: true, destOverride: ['http', 'tls', 'quic', 'fakedns'] })
    };
  }

  buildVlessWs(params: { port: number; uuid: string; domain: string }) {
    const { port, uuid, domain } = params;
    return {
      enable: true,
      port,
      protocol: 'vless',
      remark: `vless-ws`,
      settings: JSON.stringify({
        clients: [{ id: uuid, flow: '', email: uuid, enable: true, limitIp: 0, totalGB: 0, expiryTime: 0, tgId: '', subId: '', reset: 0 }],
        decryption: 'none',
        encryption: 'none',
        fallbacks: []
      }),
      streamSettings: JSON.stringify({
        network: 'ws',
        security: 'none',
        externalProxy: [],
        wsSettings: { path: '/', headers: { Host: domain } }
      }),
      sniffing: JSON.stringify({ enabled: true, destOverride: ['http', 'tls', 'quic', 'fakedns'] })
    };
  }

  buildVmessTcp(params: { port: number; uuid: string }) {
    const { port, uuid } = params;
    return {
      enable: true,
      port,
      protocol: 'vmess',
      remark: 'vmess-tcp',
      settings: JSON.stringify({
        clients: [{ id: uuid, alterId: 0, email: uuid, limitIp: 0, totalGB: 0, expiryTime: 0, enable: true, tgId: '', subId: '', reset: 0 }],
        disableInsecureEncryption: false
      }),
      streamSettings: JSON.stringify({ network: 'tcp', security: 'none', tcpSettings: { header: { type: 'http', request: { method: 'GET', path: ['/'], headers: { Host: [] } } } } }),
      sniffing: JSON.stringify({ enabled: true, destOverride: ['http', 'tls', 'quic', 'fakedns'] })
    };
  }

  buildShadowsocksTcp(params: { port: number; uuid: string }) {
    const { port, uuid } = params; 
    return {
      enable: true,
      port,
      protocol: 'shadowsocks',
      remark: 'shadowsocks-tcp',
      settings: JSON.stringify({
        method: 'aes-256-gcm',
        password: uuid,
        network: 'tcp,udp',
        clients: []
      }),
      streamSettings: JSON.stringify({ network: 'tcp', security: 'none' }),
      sniffing: JSON.stringify({ enabled: true, destOverride: ['http', 'tls', 'quic', 'fakedns'] })
    };
  }

  buildTrojanRealityTcp(params: { port: number; uuid: string; domain: string; privateKey: string; publicKey: string }) {
    const { port, uuid, domain, privateKey, publicKey } = params;
    return {
      enable: true,
      port,
      protocol: 'trojan',
      remark: `trojan-tcp-reality`,
      settings: JSON.stringify({
        clients: [{ password: uuid, email: uuid, limitIp: 0, totalGB: 0, expiryTime: 0, enable: true, tgId: '', subId: '', reset: 0 }],
        fallbacks: []
      }),
      streamSettings: JSON.stringify({
        network: 'tcp',
        security: 'reality',
        externalProxy: [],
        realitySettings: {
          show: false,
          xver: 0,
          target: `${domain}:443`,
          dest: `${domain}:443`,
          serverNames: [domain],
          privateKey: privateKey,
          shortIds: [crypto.randomBytes(4).toString('hex')],
          settings: { publicKey: publicKey, fingerprint: 'random', serverName: '', spiderX: '/' }
        }
      }),
      sniffing: JSON.stringify({ enabled: true, destOverride: ['http', 'tls', 'quic', 'fakedns'] })
    };
  }

  generateUuid() {
    return uuidv4();
  }

  buildInboundLink(inbound: any, domain: string, idOrPass: string): string {
    let link = "";

    switch (inbound.protocol) {
      case "vless":
        link = this.buildVlessLink(inbound, domain, idOrPass);
        break;
      case "vmess":
        link = this.buildVmessLink(inbound, domain, idOrPass);
        break;
      case "shadowsocks":
        link = this.buildSsLink(inbound, domain, idOrPass);
        break;
      case "trojan":
        link = this.buildTrojanLink(inbound, domain, idOrPass);
        break;
    }

    return link;
  }

  private buildVlessLink(inbound: any, domain: string, uuid: string) {
    const stream = JSON.parse(inbound.streamSettings);
    const settings = JSON.parse(inbound.settings);

    const network = stream.network;
    const security = stream.security || "none";

    const params = new URLSearchParams();

    params.set("type", network);
    params.set("encryption", "none");
    params.set("security", security);

    if (security === "reality") {
      const r = stream.realitySettings;
      params.set("pbk", r.settings.publicKey);
      params.set("fp", r.settings.fingerprint || "random");
      params.set("sni", r.serverNames?.[0] || "");
      params.set("sid", r.shortIds?.[0] || "");
      params.set("spx", '/');

      if (network === "tcp") {
        const client = settings.clients?.[0];
        if (client?.flow) {
          params.set("flow", client.flow);
        }
      }

      if (network === "xhttp") {
        const x = stream.xhttpSettings || {};
        params.set("path", x.path || "/");
        params.set("host", x.host || r.serverNames?.[0]);
        params.set("mode", x.mode || "auto");
      }

      if (network === "grpc") {
        const g = stream.grpcSettings || {};
        params.set("serviceName", g.serviceName || "grpc");
        params.set("authority", g.authority || r.serverNames?.[0]);
      }
    }

    if (network === "ws") {
      const ws = stream.wsSettings || {};
      params.set("path", ws.path || "/");
      if (ws.headers?.Host) {
        params.set("host", ws.headers.Host);
      }
    }

    return (
      `vless://${uuid}@${domain}:${inbound.port}` +
      `?${params.toString()}` +
      `#${this.flag}%20${encodeURIComponent(inbound.remark)}`
    );
  }

  private buildVmessLink(inbound: any, domain: string, uuid: string) {
    const stream = JSON.parse(inbound.streamSettings);

    const vmessObj = {
      add: domain,
      aid: '',
      alpn: "",
      fp: "",
      host: "",
      id: uuid,
      net: stream.network || "tcp",
      path: "/",
      port: inbound.port,
      ps: decodeURIComponent(this.flag) + ' ' + inbound.remark,
      scy: "",
      sni: "",
      tls: stream.security || "none",
      type: "none",
      v: "2"
    };

    const base64 = Buffer
      .from(JSON.stringify(vmessObj), "utf8")
      .toString("base64");

    return `vmess://${base64}`;
  }

  private buildSsLink(inbound: any, domain: string, idOrPass: string) {
    const settings = JSON.parse(inbound.settings);

    const method = settings.method;
    const serverPassword = settings.password;
    const finalPass = serverPassword || idOrPass;

    const userInfo = `${method}:${finalPass}`;

    const base64 = Buffer
      .from(userInfo, "utf8")
      .toString("base64");

    return `ss://${base64}@${domain}:${inbound.port}?type=tcp#${this.flag}%20${inbound.remark}`;
  }

  private buildTrojanLink(inbound: any, domain: string, password: string) {
    const stream = JSON.parse(inbound.streamSettings);
    const reality = stream.realitySettings;

    const pbk = reality.settings.publicKey;
    const sni = reality.serverNames?.[0] || domain;
    const sid = reality.shortIds?.[0] || "";
    const spx = '%2F';

    return (
      `trojan://${password}@${domain}:${inbound.port}` +
      `?type=tcp` +
      `&security=reality` +
      `&pbk=${pbk}` +
      `&fp=random` +
      `&sni=${sni}` +
      `&sid=${sid}` +
      `&spx=${spx}` +
      `#${this.flag}%20${inbound.remark}`
    );
  }
}