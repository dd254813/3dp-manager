import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { spawn, spawnSync } from 'child_process';
import { isIP } from 'net';

type StartScanPayload = {
  addr: string;
  scanSeconds?: number;
  thread?: number;
  timeout?: number;
};

type ActiveScanState = {
  runId: string;
  addr: string;
  scanSeconds: number;
  thread: number;
  timeout: number;
  startedAtMs: number;
  endsAtMs: number;
  foundCount: number;
};

type ScanResult = {
  runId: string;
  addr: string;
  scanSeconds: number;
  thread: number;
  timeout: number;
  startedAt: string;
  endsAt: string;
  finishedAt: string;
  timedOut: boolean;
  exitCode: number;
  foundCount: number;
  domains: string[];
  stderrTail: string;
  stdoutTail: string;
};

@Injectable()
export class DomainScannerService {
  private readonly logger = new Logger(DomainScannerService.name);
  private readonly scannerBin =
    process.env.SCANNER_BIN || 'RealiTLScanner-linux-64';
  private isScanRunning = false;
  private readonly logTailLimit = 8000;
  private activeScan: ActiveScanState | null = null;
  private lastScanResult: ScanResult | null = null;

  getCapabilities() {
    const scannerCheck = spawnSync(
      'sh',
      ['-lc', `command -v ${this.scannerBin}`],
      { encoding: 'utf-8' },
    );
    const timeoutCheck = spawnSync('sh', ['-lc', 'command -v timeout'], {
      encoding: 'utf-8',
    });

    return {
      scannerAvailable: scannerCheck.status === 0,
      scannerPath: scannerCheck.stdout.trim() || null,
      timeoutAvailable: timeoutCheck.status === 0,
      timeoutPath: timeoutCheck.stdout.trim() || null,
    };
  }

  getScanStatus() {
    const nowMs = Date.now();
    const active = this.activeScan;

    return {
      running: Boolean(active),
      runId: active?.runId ?? null,
      addr: active?.addr ?? null,
      scanSeconds: active?.scanSeconds ?? null,
      thread: active?.thread ?? null,
      timeout: active?.timeout ?? null,
      startedAt: active ? new Date(active.startedAtMs).toISOString() : null,
      endsAt: active ? new Date(active.endsAtMs).toISOString() : null,
      now: new Date(nowMs).toISOString(),
      remainingSeconds: active
        ? Math.max(0, Math.ceil((active.endsAtMs - nowMs) / 1000))
        : 0,
      foundCount: active?.foundCount ?? 0,
      lastRunId: this.lastScanResult?.runId ?? null,
      lastFinishedAt: this.lastScanResult?.finishedAt ?? null,
    };
  }

  getLastScanResult() {
    return this.lastScanResult;
  }

  async startScan(payload: StartScanPayload) {
    // Scanner is CPU/network heavy; keep exactly one active run per backend instance
    // to avoid accidental DoS from repeated button clicks.
    if (this.isScanRunning) {
      throw new HttpException(
        {
          message: 'Сканер уже запущен, дождитесь завершения текущего запуска',
          scanStatus: this.getScanStatus(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const addr = this.validateAndNormalizeAddr(payload.addr || '');

    const scanSeconds = this.clampNumber(payload.scanSeconds, 120, 10, 600);
    const thread = this.clampNumber(payload.thread, 2, 1, 20);
    const connectTimeout = this.clampNumber(payload.timeout, 5, 1, 20);

    const capabilities = this.getCapabilities();
    if (!capabilities.scannerAvailable) {
      throw new ServiceUnavailableException(
        `Не найден ${this.scannerBin} в контейнере`,
      );
    }
    if (!capabilities.timeoutAvailable) {
      throw new ServiceUnavailableException(
        'Не найдена утилита timeout в контейнере',
      );
    }

    const args = [
      '--signal=TERM',
      `${scanSeconds}s`,
      this.scannerBin,
      '--addr',
      addr,
      '--thread',
      String(thread),
      '--timeout',
      String(connectTimeout),
      '--out',
      '',
    ];

    const runId = this.createRunId();
    const startedAtMs = Date.now();
    const endsAtMs = startedAtMs + scanSeconds * 1000;

    this.logger.debug(
      `Starting scanner: addr=${addr}, seconds=${scanSeconds}, thread=${thread}, timeout=${connectTimeout}`,
    );

    this.isScanRunning = true;
    this.activeScan = {
      runId,
      addr,
      scanSeconds,
      thread,
      timeout: connectTimeout,
      startedAtMs,
      endsAtMs,
      foundCount: 0,
    };

    try {
      const child = spawn('timeout', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const domains = new Set<string>();
      let stdout = '';
      let stderr = '';
      let stdoutRemainder = '';

      child.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdout = this.appendTail(stdout, text);

        // Keep unfinished line tail between chunks; this prevents losing domains
        // when "cert-domain=..." is split by stream chunk boundaries.
        const combined = stdoutRemainder + text;
        const parts = combined.split(/\r?\n/);
        stdoutRemainder = parts.pop() ?? '';
        for (const line of parts) {
          this.extractDomainsFromLog(line, domains);
        }
        if (this.activeScan?.runId === runId) {
          this.activeScan.foundCount = domains.size;
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr = this.appendTail(stderr, chunk.toString());
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (code) => resolve(code ?? -1));
      }).catch((error: NodeJS.ErrnoException) => {
        this.logger.error(`Scanner process failed to start: ${error.message}`);
        throw new ServiceUnavailableException(
          `Не удалось запустить сканер: ${error.message}`,
        );
      });

      if (stdoutRemainder) {
        this.extractDomainsFromLog(stdoutRemainder, domains);
        if (this.activeScan?.runId === runId) {
          this.activeScan.foundCount = domains.size;
        }
      }

      const timedOut = exitCode === 124 || exitCode === 137 || exitCode === 143;
      if (exitCode !== 0 && !timedOut) {
        this.logger.error(
          `Scanner failed, code=${exitCode}, stderr=${stderr.slice(-1200)}`,
        );
        throw new InternalServerErrorException(
          `Сканер завершился с ошибкой (code=${exitCode})`,
        );
      }

      const sortedDomains = [...domains].sort();
      const result: ScanResult = {
        runId,
        addr,
        scanSeconds,
        thread,
        timeout: connectTimeout,
        startedAt: new Date(startedAtMs).toISOString(),
        endsAt: new Date(endsAtMs).toISOString(),
        finishedAt: new Date().toISOString(),
        timedOut,
        exitCode,
        foundCount: sortedDomains.length,
        domains: sortedDomains,
        stderrTail: stderr.slice(-800),
        stdoutTail: stdout.slice(-800),
      };

      this.lastScanResult = result;
      return result;
    } finally {
      this.isScanRunning = false;
      this.activeScan = null;
    }
  }

  private extractDomainsFromLog(text: string, out: Set<string>) {
    const regex = /cert-domain=([^\s]+)/g;
    let match: RegExpExecArray | null = regex.exec(text);
    while (match) {
      const normalized = this.normalizeDomain(match[1]);
      if (normalized) {
        out.add(normalized);
      }
      match = regex.exec(text);
    }
  }

  private normalizeDomain(input: string) {
    const cleaned = input
      .trim()
      .replace(/^"+|"+$/g, '')
      .replace(/^\*\./, '')
      .toLowerCase();

    if (!/^[a-z0-9.-]+$/.test(cleaned)) {
      return null;
    }
    if (!cleaned.includes('.')) {
      return null;
    }
    return cleaned;
  }

  private clampNumber(
    value: number | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    const num = Number.isFinite(value) ? Number(value) : fallback;
    if (num < min) return min;
    if (num > max) return max;
    return Math.floor(num);
  }

  private appendTail(current: string, incoming: string) {
    const merged = current + incoming;
    if (merged.length <= this.logTailLimit) {
      return merged;
    }
    return merged.slice(-this.logTailLimit);
  }

  private createRunId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private validateAndNormalizeAddr(input: string) {
    let value = (input || '').trim().toLowerCase();
    if (!value) {
      throw new BadRequestException('Поле addr обязательно');
    }

    // Reject URL-like input to avoid ambiguous parsing.
    if (/^[a-z]+:\/\//i.test(value) || /[/?#]/.test(value)) {
      throw new BadRequestException(
        'Укажите только IP или hostname без схемы и пути',
      );
    }

    // Support common copy-paste format: [IPv6]
    value = value.replace(/^\[|\]$/g, '');

    // Normalize FQDN with trailing dot to plain host form.
    value = value.replace(/\.+$/, '');
    if (!value) {
      throw new BadRequestException('Некорректный addr');
    }

    if (
      value === 'localhost' ||
      isIP(value) > 0 ||
      this.isValidHostname(value)
    ) {
      return value;
    }

    throw new BadRequestException(
      'Некорректный addr: укажите IPv4/IPv6 или hostname',
    );
  }

  private isValidHostname(hostname: string) {
    if (hostname.length > 253) return false;
    const labels = hostname.split('.');
    if (labels.length === 0) return false;

    return labels.every((label) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label),
    );
  }
}
