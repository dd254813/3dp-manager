import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

@Injectable()
export class InboundBuilderService {
  private flag = process.env.COUNTRY_FLAG ?? '%F0%9F%92%AF';

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
      sniffing: JSON.stringify({ enabled: false, destOverride: ['http', 'tls', 'quic', 'fakedns'], metadataOnly: false, routeOnly: false })
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
        clients: [{ id: uuid, flow: '', email: uuid, enable: true, limitIp: 0, totalGB: 0, expiryTime: 0, tgId: '', subId: '', reset: 0 }],
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
        xhttpSettings: {
          host: domain,
          path: "/",
          mode: "auto",
          noSSEHeader: false,
          scMaxBufferedPosts: 30,
          scMaxEachPostBytes: "1000000",
          scStreamUpServerSecs: "20-80",
          xPaddingBytes: "100-1000"
        }
      }),
      sniffing: JSON.stringify({
        enabled: false,
        destOverride: ["http", "tls", "quic", "fakedns"],
        metadataOnly: false,
        routeOnly: false
      })
    };
  }

  buildVlessRealityGrpc(params: { port: number; uuid: string; domain: string; privateKey: string; publicKey: string }) {
    const { port, uuid, domain, privateKey, publicKey } = params;
    return {
      enable: true,
      port,
      protocol: "vless",
      remark: "vless-grpc-reality",
      settings: JSON.stringify({
        clients: [{
          id: uuid,
          email: uuid,
          enable: true,
          flow: "",
          limitIp: 0,
          totalGB: 0,
          expiryTime: 0,
          tgId: "",
          subId: "",
          reset: 0
        }],
        decryption: "none",
        encryption: "none",
        fallbacks: []
      }),
      streamSettings: JSON.stringify({
        network: "grpc",
        security: "reality",
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
        grpcSettings: {
          serviceName: "myservice",
          authority: domain,
          multiMode: false,
        }
      }),
      sniffing: JSON.stringify({
        enabled: false,
        destOverride: ["http", "tls", "quic", "fakedns"],
        metadataOnly: false,
        routeOnly: false
      })
    };
  }

  buildVlessWs(params: { port: number; uuid: string; sni: string }) {
    const { port, uuid, sni } = params;
    return {
      enable: true,
      port,
      protocol: 'vless',
      remark: `vless-ws`,
      settings: JSON.stringify({
        clients: [{
          id: uuid,
          email: uuid,
          enable: true,
          flow: "",
          limitIp: 0,
          totalGB: 0,
          expiryTime: 0,
          tgId: "",
          subId: "",
          reset: 0
        }],
        decryption: "none",
        encryption: "none",
        fallbacks: []
      }),
      streamSettings: JSON.stringify({
        network: "ws",
        security: "none",
        externalProxy: [],
        wsSettings: {
          host: sni,
          path: "/",
          acceptProxyProtocol: false,
          heartbeatPeriod: 0,
        }
      }),
      sniffing: JSON.stringify({
        enabled: false,
        destOverride: ["http", "tls", "quic", "fakedns"],
        metadataOnly: false,
        routeOnly: false
      })
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
        clients: [{
          id: uuid,
          flow: "",
          email: uuid,
          enable: true,
          limitIp: 0,
          totalGB: 0,
          expiryTime: 0,
          tgId: "",
          subId: "0",
          alterId: "0",
          reset: 0
        }],
      }),
      streamSettings: JSON.stringify({
        network: "tcp",
        security: "none",
        tcpSettings: {
          acceptProxyProtocol: false,
          header: { type: "none" }
        }
      }),
      sniffing: JSON.stringify({
        enabled: false,
        destOverride: ["http", "tls", "quic", "fakedns"],
        metadataOnly: false,
        routeOnly: false
      })
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
        clients: [{
          id: "",
          flow: "",
          email: uuid,
          password: crypto.randomBytes(32).toString("base64"),
          enable: true,
          limitIp: 0,
          totalGB: 0,
          expiryTime: 0,
          tgId: "",
          subId: "",
          reset: 0
        }],
        ivCheck: false,
        method: "2022-blake3-aes-256-gcm",
        network: "tcp",
        password: crypto.randomBytes(32).toString("base64")
      }),
      streamSettings: JSON.stringify({
        network: "tcp",
        security: "none",
        tcpSettings: {
          acceptProxyProtocol: false,
          header: { type: "none" }
        }
      }),
      sniffing: JSON.stringify({
        enabled: false,
        destOverride: ["http", "tls", "quic", "fakedns"],
        metadataOnly: false,
        routeOnly: false
      })
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
        clients: [{
          id: uuid,
          email: uuid,
          password: crypto.randomBytes(8).toString("hex"),
          enable: true,
          flow: "",
          limitIp: 0,
          totalGB: 0,
          expiryTime: 0,
          tgId: "",
          subId: "",
          reset: 0
        }],
        fallbacks: []
      }),
      streamSettings: JSON.stringify({
        network: "tcp",
        security: "reality",
        externalProxy: [],
        realitySettings: {
          show: false,
          xver: 0,
          target: `${domain}:443`,
          dest: `${domain}:443`,
          serverNames: [domain],
          privateKey: privateKey,
          shortIds: [
            crypto.randomBytes(4).toString("hex"),
            crypto.randomBytes(3).toString("hex"),
            crypto.randomBytes(8).toString("hex"),
            crypto.randomBytes(2).toString("hex"),
            crypto.randomBytes(2).toString("hex"),
            crypto.randomBytes(2).toString("hex"),
            crypto.randomBytes(2).toString("hex"),
            crypto.randomBytes(4).toString("hex")
          ],
          settings: {
            publicKey: publicKey,
            fingerprint: "random",
            serverName: "",
            spiderX: "/"
          }
        },
        tcpSettings: {
          acceptProxyProtocol: false,
          header: { type: "none" }
        }
      }),
      sniffing: JSON.stringify({
        enabled: false,
        destOverride: ["http", "tls", "quic", "fakedns"],
        metadataOnly: false,
        routeOnly: false
      })
    };
  }

  generateUuid() {
    return uuidv4();
  }

  buildInboundLink(inbound: any, domain: string, idOrPass: string, flagEmoji: string): string {
    this.flag = flagEmoji;
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
      aid: '0',
      alpn: "",
      fp: "",
      host: "",
      id: uuid,
      net: stream.network || "tcp",
      path: "/",
      port: inbound.port.toString(),
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
    const clientPassword = settings.clients[0].password;

    const userInfo = `${method}:${serverPassword}:${clientPassword}`;

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

  buildHysteria2Link(serverAddress: string, sni: string, remark: string): string {
    let auth = 'YOUR_AUTH';
    let obfs = 'salamander';
    let obfsPass = 'YOUR_PASS';
    let port = 443;

    try {
      const configPath = '/etc/hysteria/config.yaml';

      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf8');

        const authMatch = fileContent.match(/password:\s*['"]?([^'"\n]+)['"]?/);
        if (authMatch) auth = authMatch[1];

        const obfsMatch = fileContent.match(/type:\s*['"]?(salamander)['"]?/);
        if (obfsMatch) obfs = obfsMatch[1];

        const passMatch = fileContent.match(/salamander:[\s\S]*?password:\s*['"]?([^'"\n]+)['"]?/);
        if (passMatch) obfsPass = passMatch[1];

        const listenMatch = fileContent.match(/listen:\s*['"]?:(\d+)['"]?/);
        if (listenMatch) port = parseInt(listenMatch[1], 10);
      } else {
        console.warn(`Конфиг Hysteria2 не найден по пути: ${configPath}`);
      }
    } catch (e) {
      console.error('Ошибка чтения конфига Hysteria2', e);
    }

    const params = new URLSearchParams();
    params.set('insecure', '0');
    params.set('sni', serverAddress);
    params.set('obfs', obfs);
    params.set('obfs-password', obfsPass);

    return `hy2://${auth}@${serverAddress}:${port}/?${params.toString()}#${remark}`;
  }
}