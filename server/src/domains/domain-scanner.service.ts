import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { spawn, spawnSync } from 'child_process';

type StartScanPayload = {
  addr: string;
  scanSeconds?: number;
  thread?: number;
  timeout?: number;
};

@Injectable()
export class DomainScannerService {
  private readonly logger = new Logger(DomainScannerService.name);
  private readonly scannerBin = 'RealiTLScanner-linux-64';
  private isScanRunning = false;
  private readonly logTailLimit = 8000;

  getCapabilities() {
    const scannerCheck = spawnSync('sh', ['-lc', `command -v ${this.scannerBin}`], { encoding: 'utf-8' });
    const timeoutCheck = spawnSync('sh', ['-lc', 'command -v timeout'], { encoding: 'utf-8' });

    return {
      scannerAvailable: scannerCheck.status === 0,
      scannerPath: scannerCheck.stdout.trim() || null,
      timeoutAvailable: timeoutCheck.status === 0,
      timeoutPath: timeoutCheck.stdout.trim() || null,
    };
  }

  async startScan(payload: StartScanPayload) {
    // Scanner is CPU/network heavy; keep exactly one active run per backend instance
    // to avoid accidental DoS from repeated button clicks.
    if (this.isScanRunning) {
      throw new HttpException('Сканер уже запущен, дождитесь завершения текущего запуска', HttpStatus.TOO_MANY_REQUESTS);
    }

    const addr = (payload.addr || '').trim();
    if (!addr) {
      throw new BadRequestException('Поле addr обязательно');
    }

    const scanSeconds = this.clampNumber(payload.scanSeconds, 120, 10, 600);
    const thread = this.clampNumber(payload.thread, 2, 1, 20);
    const connectTimeout = this.clampNumber(payload.timeout, 5, 1, 20);

    const capabilities = this.getCapabilities();
    if (!capabilities.scannerAvailable) {
      throw new ServiceUnavailableException(`Не найден ${this.scannerBin} в контейнере`);
    }
    if (!capabilities.timeoutAvailable) {
      throw new ServiceUnavailableException('Не найдена утилита timeout в контейнере');
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

    this.logger.log(`Starting scanner: addr=${addr}, seconds=${scanSeconds}, thread=${thread}, timeout=${connectTimeout}`);

    this.isScanRunning = true;
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
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr = this.appendTail(stderr, chunk.toString());
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (code) => resolve(code ?? -1));
      }).catch((error: NodeJS.ErrnoException) => {
        this.logger.error(`Scanner process failed to start: ${error.message}`);
        throw new ServiceUnavailableException(`Не удалось запустить сканер: ${error.message}`);
      });

      if (stdoutRemainder) {
        this.extractDomainsFromLog(stdoutRemainder, domains);
      }

      const timedOut = exitCode === 124 || exitCode === 137 || exitCode === 143;
      if (exitCode !== 0 && !timedOut) {
        this.logger.error(`Scanner failed, code=${exitCode}, stderr=${stderr.slice(-1200)}`);
        throw new InternalServerErrorException(`Сканер завершился с ошибкой (code=${exitCode})`);
      }

      const sortedDomains = [...domains].sort();
      return {
        addr,
        scanSeconds,
        thread,
        timeout: connectTimeout,
        timedOut,
        exitCode,
        foundCount: sortedDomains.length,
        domains: sortedDomains,
        stderrTail: stderr.slice(-800),
        stdoutTail: stdout.slice(-800),
      };
    } finally {
      this.isScanRunning = false;
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

  private clampNumber(value: number | undefined, fallback: number, min: number, max: number) {
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
}
