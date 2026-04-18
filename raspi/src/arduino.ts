/**
 * Arduino Nano USB Haberleşme Katmanı (serialport)
 *
 * Protokol (text tabanlı, \n terminatörlü):
 *
 * RPi → Arduino:
 *   VALVE:n:ON / VALVE:n:OFF    → n. valfi aç/kapat (0–9)
 *   MOTOR:1:OPEN / MOTOR:1:CLOSE → Giriş kilidi motoru
 *   MOTOR:2:OPEN / MOTOR:2:CLOSE → Çıkış kilidi motoru
 *   ESTOP                        → Acil durdur
 *   RESET                        → Sıfırla
 *   STATUS                       → Durum iste
 *
 * Arduino → RPi:
 *   OK:...              → Komut onayı
 *   ERR:...             → Hata mesajı
 *   SENSOR:0:ON         → Giriş sensörü tetiklendi
 *   SENSOR:1:ON         → Çıkış sensörü tetiklendi
 *   LIMIT:entry_cw:ON   → Giriş kilidi tamamen kapandı
 *   LIMIT:entry_ccw:ON  → Giriş kilidi tamamen açıldı
 *   LIMIT:exit_cw:ON    → Çıkış kilidi tamamen kapandı
 *   LIMIT:exit_ccw:ON   → Çıkış kilidi tamamen açıldı
 *   STATUS:...          → Genel durum yanıtı
 *
 * ARDUINO_SIMULATION=true → Gerçek port açılmaz, sadece konsolda log
 */

import { EventEmitter } from 'events';

export class ArduinoManager extends EventEmitter {
  private _connected = false;
  private portPath: string;
  private baudRate: number;
  private simulated: boolean;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // Dynamic imports — serialport is optional (not needed in simulation)
  private portInstance: any = null;

  constructor(portPath: string, baudRate: number, simulated = true) {
    super();
    this.portPath = portPath;
    this.baudRate = baudRate;
    this.simulated = simulated;

    if (simulated) {
      this._connected = true;
      console.log('[Arduino] Simülasyon modunda çalışıyor.');
    } else {
      this.connect();
    }
  }

  get isConnected() { return this._connected; }
  get isSimulated() { return this.simulated; }
  get port() { return this.portPath; }
  get baud() { return this.baudRate; }

  private async connect() {
    try {
      // Dynamic import to avoid breaking if serialport is not installed
      const { SerialPort } = await import('serialport');
      const { ReadlineParser } = await import('@serialport/parser-readline');

      this.portInstance = new SerialPort({ path: this.portPath, baudRate: this.baudRate });
      const parser = this.portInstance.pipe(new ReadlineParser({ delimiter: '\n' }));

      this.portInstance.on('open', () => {
        console.log(`[Arduino] Bağlandı → ${this.portPath} @ ${this.baudRate} baud`);
        this._connected = true;
        this.emit('connected');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      });

      parser.on('data', (line: string) => {
        const trimmed = line.trim();
        if (trimmed) {
          console.log(`[Arduino] ← ${trimmed}`);
          this.emit('data', trimmed);
        }
      });

      this.portInstance.on('error', (err: Error) => {
        // Port yoksa veya Arduino bağlı değilse sessizce yeniden bağlanmayı dene
        console.warn(`[Arduino] Bağlantı sorunu: ${err.message}`);
        this._connected = false;
        this.emit('disconnected');
        this.scheduleReconnect();
      });

      this.portInstance.on('close', () => {
        console.warn('[Arduino] Port kapandı, yeniden bağlanıyor...');
        this._connected = false;
        this.emit('disconnected');
        this.scheduleReconnect();
      });

    } catch (err: any) {
      // Port açılamadı — Arduino bağlı değil olabilir, sessizce bekle
      console.warn(`[Arduino] Port açılamadı (${this.portPath}): ${err.message || err}`);
      this._connected = false;
      this.emit('disconnected');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.simulated || this.reconnectTimer) return;
    console.warn(`[Arduino] ${this.portPath} için 10s sonra yeniden denenecek...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 10000); // 10sn — daha az log spam
  }

  sendCommand(cmd: string): Promise<string> {
    return new Promise((resolve) => {
      const fullCmd = cmd.trimEnd() + '\n';

      if (this.simulated) {
        console.log(`[Arduino SIM] → ${cmd.trim()}`);
        setTimeout(() => resolve(`OK:${cmd.trim()}`), 5);
        return;
      }

      if (!this.portInstance || !this._connected) {
        resolve('ERR:NOT_CONNECTED');
        return;
      }

      console.log(`[Arduino] → ${cmd.trim()}`);
      this.emit('command', cmd.trim());
      this.portInstance.write(fullCmd, (err: Error | null) => {
        resolve(err ? `ERR:${err.message}` : `OK:${cmd.trim()}`);
      });
    });
  }

  async listPorts(): Promise<any[]> {
    try {
      const { SerialPort } = await import('serialport');
      return await SerialPort.list();
    } catch {
      return [];
    }
  }

  async disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.portInstance?.isOpen) {
      await this.sendCommand('ESTOP');
      this.portInstance.close();
    }
    this._connected = false;
  }
}
