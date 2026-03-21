import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'ssh2';

@Injectable()
export class SshService {
  private readonly logger = new Logger(SshService.name);

  async executeCommand(
    config: { host: string; port: number; username: string; password?: string, privateKey?: string },
    command: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      
      conn.on('ready', () => {
        this.logger.log(`SSH Connection established to ${config.host}`);
        
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          
          let output = '';
          
          stream.on('close', (code, signal) => {
            this.logger.log(`SSH Command finished with code ${code}`);
            conn.end();
            if (code === 0) resolve(output);
            else reject(new Error(`Exit code ${code}. Output: ${output}`));
          }).on('data', (data) => {
            output += data.toString();
          }).stderr.on('data', (data) => {
            output += data.toString();
          });
        });
      }).on('error', (err) => {
        this.logger.error(`SSH Error: ${err.message}`);
        reject(err);
      }).connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey,
        readyTimeout: 20000,
      });
    });
  }
}