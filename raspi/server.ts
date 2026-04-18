import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { SystemState, Device } from './src/types';
import {
  initDb, loadConfig, saveConfig,
  startCycle, completeCycle, getProductionHistory,
  addAlarm, resolveAlarm, getAlarms,
  getDevices, saveDevice, deleteDevice
} from './src/db';
import { ArduinoManager } from './src/arduino';

let GpioClient: any = null;
import('onoff').then(m => {
  if (m.Gpio.accessible) {
    GpioClient = m.Gpio;
  } else {
    console.warn('[GPIO] Donanım pinlerine erişim yok. (Raspi dışındasınız veya root değilsiniz).');
  }
}).catch(() => console.warn('[GPIO] Gpio kütüphanesi yüklenemedi.'));

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const ARDUINO_PORT      = process.env.ARDUINO_PORT      || '/dev/ttyUSB0';
const ARDUINO_BAUDRATE  = parseInt(process.env.ARDUINO_BAUDRATE  || '115200');

// ─── Sistem Durumu ───────────────────────────────────────────────────────────
const state: SystemState = {
  systemRunning: false,
  paused: false,
  emergencyStop: false,
  hasError: false,
  
  process: {
    state: 'IDLE',
    bottlesInArea: 0,
    targetBottles: 10,
    currentCycleId: undefined,
  },
  
  hardware: {
    rpi:  { connected: true,  status: 'Aktif' },
    nano: { connected: false, port: ARDUINO_PORT, baudRate: ARDUINO_BAUDRATE, status: 'Bekleniyor...' },
  },
  config: {
    targetVolumeML: 40,    // Default 40 ML
    baseFlowRateMs: 50,    // Default 50ms per ML (2 sec for 40 ML)
    sensorTimeout: 30000,
    dailyQuota: 10000,
    dropDelayMs: 500,      // Default 500ms damla bekleme süresi
    conveyorSpeed: 80,     // Default %80 Hız
  },
  paused: false,
  devices: [], // startServer içinde yüklenecek
  rawLogs: [],
  notifications: []
};

// ─── AKILLI PORT ANALİZİ ───────────────────────────────────────────────────
function analyzeLikelyPLC(port: any): boolean {
  const p = port.path.toLowerCase();
  const m = (port.manufacturer || '').toLowerCase();
  const v = (port.vendorId || '').toLowerCase();
  
  // Bilinen PLC/Arduino VID'leri ve Üreticileri
  const plcKeywords = ['arduino', 'ch340', 'cp210', 'ftdi', 'usb-serial', 'ttyusb', 'ttyacm'];
  const plcVids     = ['2341', '1a86', '0403', '10c4']; // Arduino, CH340, FTDI, CP210x

  return plcKeywords.some(k => p.includes(k) || m.includes(k)) || plcVids.includes(v);
}

let lastKnownPorts: string[] = [];
async function scanPortsAndNotify() {
  try {
    const ports = await arduino.listPorts();
    const currentPaths = ports.map(p => p.path);
    
    // Yeni takılanları bul
    const newPorts = ports.filter(p => !lastKnownPorts.includes(p.path));
    
    for (const p of newPorts) {
      if (analyzeLikelyPLC(p)) {
        const notify = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'success' as const,
          title: 'YENİ DONANIM ALGILANDI',
          message: `PLC Sürücüsü (Arduino/Nano) ${p.path} portuna bağlandı. Terminalden seçim yapabilirsiniz.`,
          timestamp: new Date().toISOString()
        };
        state.notifications = [notify, ...state.notifications].slice(0, 10);
        console.log(`[HMI] Yeni PLC algılandı: ${p.path}`);
      }
    }
    
    lastKnownPorts = currentPaths;
  } catch (e) {
    console.error('[HMI] Port tarama hatası:', e);
  }
}

// 4 saniyede bir arka planda tara
setInterval(scanPortsAndNotify, 4000);

// ─── LOGGING MEKANİZMASI ───────────────────────────────────────────────────
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function logComm(direction: 'IN' | 'OUT' | 'INTERNAL', source: 'RPI' | 'NANO' | 'SENSOR' | 'SYSTEM', msg: string, level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
  const logEntry = {
    id: Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    direction,
    source,
    msg,
    level
  };

  // UI Buffer Güncelle (Son 100 kayıt)
  state.rawLogs = [logEntry, ...state.rawLogs].slice(0, 100);

  // Dosya Kaydı (Günlük JSONL formatı - Performans için her satır bir JSON)
  const dateStr = new Date().toISOString().split('T')[0];
  const logFile = path.join(LOG_DIR, `comm_${dateStr}.json`);
  fs.appendFile(logFile, JSON.stringify(logEntry) + '\n', (err) => {
    if (err) console.error('[LOG] Yazma hatası:', err);
  });
}

// ─── Arduino Master Yöneticisi ────────────────────────────────────────────────
let arduino: ArduinoManager;
let terminalArduino: ArduinoManager | null = null;

// ─── Raspi GPIO (Sensörler) Olay Dinleyicileri (Event Driven) ─────────────────
const gpioInstances: Record<string, any> = {};

function setupGpioWatchers() {
  // Eski watcherları temizle
  Object.values(gpioInstances).forEach(gpio => {
    try { gpio.unexport(); } catch(e){}
  });

  if (!GpioClient) return;

  for (const dev of state.devices) {
    if (dev.target === 'raspi' && (dev.role === 'entry_laser' || dev.role === 'exit_laser')) {
      try {
        const pinNum = parseInt(dev.pin.replace(/\D/g, ''));
        const sensor = new GpioClient(pinNum, 'in', 'falling'); // Düşen kenar tetiklemesi
        gpioInstances[dev.id] = sensor;
        
        sensor.watch((err: any, value: number) => {
          if (err) return;
          if (!state.systemRunning) return;

            if (dev.role === 'entry_laser' && state.process.state === 'WAITING_ENTRY') {
              logComm('IN', 'SENSOR', `Giriş Lazeri Tetiklendi. Sayım: ${dev.count + 1}`, 'DEBUG');
              dev.count = (dev.count || 0) + 1;
              dev.active = true; setTimeout(() => { dev.active = false; }, 200);
              state.process.bottlesInArea = dev.count;

              if (state.process.bottlesInArea >= state.process.targetBottles) {
                dev.count = 0; // Sıfırla
                startAutonomousFilling();
              }
            } 
            else if (dev.role === 'exit_laser' && state.process.state === 'WAITING_EXIT') {
              logComm('IN', 'SENSOR', `Çıkış Lazeri Tetiklendi. Sayım: ${dev.count + 1}`, 'DEBUG');
              dev.count = (dev.count || 0) + 1;
              dev.active = true; setTimeout(() => { dev.active = false; }, 200);
              
              if (dev.count >= state.process.targetBottles) {
                dev.count = 0;
                finishCycle();
              }
            }
          });
          logComm('INTERNAL', 'SYSTEM', `GPIO Sensörü ${dev.name} pine bağlandı: ${pinNum}`, 'INFO');
          console.log(`[GPIO] Raspi sensörü ${dev.name} pine bağlandı: ${pinNum}`);
      } catch (e: any) {
        console.error(`[GPIO] Cihaz bağlanamadı: ${dev.name}`, e.message);
      }
    }
  }
}

// ─── Otonom Süreç Kontrol Fonksiyonları ───────────────────────────────────────
function findDeviceByRole(role: string): Device | undefined {
  return state.devices.find(d => d.role === role);
}

function openEntryGate() {
  const gate = findDeviceByRole('entry_lock');
  if (gate && gate.target === 'nano') {
    arduino.sendCommand(`OPEN:${gate.pin}`);
  }
}

function closeEntryGate() {
  const gate = findDeviceByRole('entry_lock');
  if (gate && gate.target === 'nano') {
    arduino.sendCommand(`CLOSE:${gate.pin}`);
  }
}

function openExitGate() {
  const gate = findDeviceByRole('exit_lock');
  if (gate && gate.target === 'nano') {
    arduino.sendCommand(`OPEN:${gate.pin}`);
  }
}

function closeExitGate() {
  const gate = findDeviceByRole('exit_lock');
  if (gate && gate.target === 'nano') {
    arduino.sendCommand(`CLOSE:${gate.pin}`);
  }
}

function startAutonomousFilling() {
  closeEntryGate();
  state.process.state = 'FILLING';
  
  // 1 saniye kilit güvenliği beklemesi
  setTimeout(() => {
    // Nano'ya hangi valfleri ne kadar süreyle açacağını hesaplayıp gönder
    const fillCmdParts: string[] = [];
    const targetML = state.config.targetVolumeML || 40;
    const baseFlowRate = state.config.baseFlowRateMs || 50;

    for (let i = 1; i <= state.process.targetBottles; i++) {
       const valve = findDeviceByRole(`valve_${i}`);
       if (valve && valve.target === 'nano') {
         const valveRate = valve.fillDurationMs || baseFlowRate; 
         const computedMs = Math.round(targetML * valveRate);
         fillCmdParts.push(`${valve.pin}=${computedMs}`);
       }
    }
    
    if (fillCmdParts.length > 0) {
      const fwCmd = `FILL_START:${fillCmdParts.join(',')}`;
      console.log(`[SÜREÇ] Dolum Başlıyor: ${fwCmd}`);
      arduino.sendCommand(fwCmd);
    } else {
      console.warn(`[SÜREÇ] Sisteme hiç valf tanımlanmamış. Otomatik atlanıyor.`);
      setTimeout(() => {
        state.process.state = 'WAITING_EXIT';
        openExitGate();
      }, 1000);
    }
  }, 1000);
}

function finishCycle() {
  closeExitGate();
  state.process.bottlesInArea = 0;
  
  if (state.process.currentCycleId) {
    completeCycle(state.process.currentCycleId, 'completed', state.process.targetBottles, state.process.targetBottles);
    state.process.currentCycleId = undefined;
  }
  
  if (state.systemRunning && !state.paused) {
    state.process.state = 'WAITING_ENTRY';
    state.process.currentCycleId = startCycle();
    openEntryGate();
    console.log('[SÜREÇ] Döngü tamamlandı. Yenisi başlıyor.');
  } else {
    state.process.state = 'IDLE';
    if (state.paused) console.log('[SÜREÇ] Döngü bitti. Sistem DURAKLATILDIĞI için beklemeye alınıyor.');
  }
}

// ─── Express Sunucu ───────────────────────────────────────────────────────────
async function startServer() {
  // DB Başlatma
  await initDb();
  
  // Cihazları Yükle
  state.devices = getDevices();
  setupGpioWatchers(); // Raspi GPIO event watcher'larını kur

  // Config Yükle
  const saved = loadConfig();
  if (saved.targetBottles) state.process.targetBottles = parseInt(saved.targetBottles);
  if (saved.targetVolumeML) state.config.targetVolumeML = parseInt(saved.targetVolumeML);
  if (saved.baseFlowRateMs) state.config.baseFlowRateMs = parseInt(saved.baseFlowRateMs);
  if (saved.sensorTimeout) state.config.sensorTimeout = parseInt(saved.sensorTimeout);
  if (saved.dailyQuota) state.config.dailyQuota = parseInt(saved.dailyQuota);
  if (saved.dropDelayMs) state.config.dropDelayMs = parseInt(saved.dropDelayMs);
  if (saved.conveyorSpeed) state.config.conveyorSpeed = parseInt(saved.conveyorSpeed);

  // DB ve Konfigürasyonlar tam hazır olduktan sonra Arduino'yu başlat
  arduino = new ArduinoManager(ARDUINO_PORT, ARDUINO_BAUDRATE, false);

  arduino.on('connected', async () => {
    state.hardware.nano.connected = true;
    state.hardware.nano.status    = 'Bağlı';
    logComm('INTERNAL', 'SYSTEM', `PLC Driver (Nano) USB üzerinden bağlandı: ${ARDUINO_PORT}`, 'INFO');
    addAlarm('INFO', `PLC OUT Driver bağlandı: ${ARDUINO_PORT}`);
    
    // Nano'ya cihaz konfigürasyonlarını yolla
    for (const dev of state.devices) {
      if (dev.target === 'nano') {
        const typeStr = dev.type === 'valve' || dev.type === 'motor' ? 'valve' : dev.type;
        await arduino.sendCommand(`PINCFG:${typeStr}:${dev.pin}`);
      }
    }
  });

  arduino.on('disconnected', () => {
    state.hardware.nano.connected = false;
    state.hardware.nano.status    = 'Bağlantı Kesildi';
    state.hasError = true;
    state.systemRunning = false;
    logComm('INTERNAL', 'SYSTEM', 'PLC Driver (Nano) bağlantısı kesildi!', 'ERROR');
    addAlarm('MOTOR_FAULT', 'PLC OUT Driver bağlantısı kesildi!');
  });

  arduino.on('command', (cmd: string) => {
    logComm('OUT', 'RPI', cmd, 'DEBUG');
  });

  arduino.on('data', (line: string) => {
    logComm('IN', 'NANO', line, line.startsWith('ERR:') ? 'ERROR' : 'INFO');
    if (line === 'FILL_DONE' && state.process.state === 'FILLING') {
      state.process.state = 'WAITING_EXIT';
      console.log('[SÜREÇ] Dolumlar Tamamlandı. Çıkış bekleniyor.');
      openExitGate();
    } else if (line === 'FILL_DONE' && state.process.state === 'WASHING') {
      state.process.state = 'IDLE';
      console.log('[SÜREÇ] CIP Yıkama Tamamlandı.');
    } else if (line.startsWith('ERR:')) {
      addAlarm('MOTOR_FAULT', `Pano Hatası: ${line}`);
      state.hasError = true;
    }
  });

  const app  = express();
  const PORT = parseInt(process.env.PORT || '3000');

  app.use(express.json());

  app.get('/api/state', (_req, res) => {
    res.json(state);
  });

  app.post('/api/estop', (req, res) => {
    state.emergencyStop = req.body.active;
    if (state.emergencyStop) {
      logComm('INTERNAL', 'SYSTEM', 'ACİL STOP AKTİF EDİLDİ!', 'ERROR');
      state.systemRunning = false;
      state.process.state = 'IDLE';
      addAlarm('ESTOP', 'Acil stop butonu etkinleştirildi!');
      
      if (state.process.currentCycleId) {
        completeCycle(state.process.currentCycleId, 'estop', state.process.bottlesInArea, 0);
        state.process.currentCycleId = undefined;
      }
      arduino.sendCommand('ESTOP');
    }
    res.json(state);
  });

  app.post('/api/system', (req, res) => {
    if (state.emergencyStop) return res.status(400).json({ error: 'Acil stop aktif' });
    
    const wasRunning = state.systemRunning;
    state.systemRunning = req.body.running;
    
    if (state.systemRunning && !wasRunning) {
      logComm('INTERNAL', 'SYSTEM', 'Üretim Hattı Başlatıldı', 'INFO');
      // Sistemi Başlat
      state.process.state = 'WAITING_ENTRY';
      state.process.bottlesInArea = 0;
      state.process.currentCycleId = startCycle();
      closeExitGate();
      openEntryGate();
    } 
    else if (!state.systemRunning && wasRunning) {
      logComm('INTERNAL', 'SYSTEM', 'Üretim Hattı Durduruldu', 'WARN');
      // Sistemi Durdur
      state.process.state = 'IDLE';
      closeEntryGate();
      closeExitGate();
      if (state.process.currentCycleId) {
        completeCycle(state.process.currentCycleId, 'interrupted', state.process.bottlesInArea, 0);
        state.process.currentCycleId = undefined;
      }
    }
    res.json(state);
  });

  app.post('/api/pause', (req, res) => {
    state.paused = req.body.paused;
    console.log(`[SİSTEM] Duraklatma Durumu: ${state.paused}`);
    
    // Eğer duraklatma KALDIRILDI ve sistem hala RUNNING ise ama IDLE'da bekliyorsa tetikle
    if (!state.paused && state.systemRunning && state.process.state === 'IDLE') {
      state.process.state = 'WAITING_ENTRY';
      state.process.currentCycleId = startCycle();
      openEntryGate();
    }
    
    res.json(state);
  });

  app.post('/api/cancel', (req, res) => {
    state.systemRunning = false;
    state.paused = false;
    state.process.state = 'IDLE';
    addAlarm('INFO', 'Süreç kullanıcı tarafından İPTAL EDİLDİ.');
    
    if (state.process.currentCycleId) {
      completeCycle(state.process.currentCycleId, 'interrupted', state.process.bottlesInArea, 0);
      state.process.currentCycleId = undefined;
    }
    
    // PLC'ye dur komutu gönder (Valfleri ve kilitleri kapatması için)
    if (arduino.isConnected) {
      // Bütün bilinen kilit ve valfleri kapatmaya zorla
      state.devices.forEach(d => {
        if (d.target === 'nano' && (d.type === 'valve' || d.role.includes('lock'))) {
          arduino.sendCommand(`CLOSE:${d.pin}`);
        }
      });
    }
    
    res.json(state);
  });

  app.post('/api/wash', (req, res) => {
    if (state.systemRunning) return res.status(400).json({ error: 'Sistem çalışırken yıkama yapılamaz' });
    if (state.emergencyStop) return res.status(400).json({ error: 'Acil stop aktif' });

    const totalDuration = req.body.duration || 60000;
    state.process.state = 'WASHING';
    
    const washValves = state.devices.filter(d => d.target === 'nano' && d.type === 'valve');
    if (washValves.length === 0) {
      setTimeout(() => { state.process.state = 'IDLE'; }, 1000);
      return res.json(state);
    }

    let elapsed = 0;
    const pulseActive = 5000; // 5sn Açık
    const pulseWait = 2000;   // 2sn Kapalı
    const cycleTime = pulseActive + pulseWait;

    console.log(`[SÜREÇ] Darbeli CIP Yıkama Başlıyor (Hedef: ${totalDuration}ms)`);

    const washInterval = setInterval(() => {
      if (elapsed >= totalDuration || state.emergencyStop || !state.systemRunning && state.process.state !== 'WASHING') {
        clearInterval(washInterval);
        state.process.state = 'IDLE';
        console.log('[SÜREÇ] CIP Yıkama Bitti veya Durduruldu.');
        return;
      }

      if (state.paused) {
        // Duraklatılmışsa bu darbeyi atla (elapsed artmaz)
        return;
      }

      const fwCmd = `FILL_START:${washValves.map(v => `${v.pin}=${pulseActive}`).join(',')}`;
      console.log(`[SÜREÇ] Yıkama Darbesi Gönderiliyor (${elapsed}/${totalDuration}ms)`);
      if (arduino.isConnected) arduino.sendCommand(fwCmd);
      
      elapsed += cycleTime;
    }, cycleTime);

    // İlk tetikleme
    const fwCmd = `FILL_START:${washValves.map(v => `${v.pin}=${pulseActive}`).join(',')}`;
    if (arduino.isConnected) arduino.sendCommand(fwCmd);
    elapsed += cycleTime;

    res.json(state);
  });

  app.post('/api/config', (req, res) => {
    const updates = req.body;
    if (updates.targetBottles !== undefined) {
      state.process.targetBottles = updates.targetBottles;
      saveConfig('targetBottles', updates.targetBottles.toString());
    }
    if (updates.targetVolumeML !== undefined) {
      state.config.targetVolumeML = updates.targetVolumeML;
      saveConfig('targetVolumeML', updates.targetVolumeML.toString());
    }
    if (updates.baseFlowRateMs !== undefined) {
      state.config.baseFlowRateMs = updates.baseFlowRateMs;
      saveConfig('baseFlowRateMs', updates.baseFlowRateMs.toString());
    }
    if (updates.sensorTimeout !== undefined) {
      state.config.sensorTimeout = updates.sensorTimeout;
      saveConfig('sensorTimeout', updates.sensorTimeout.toString());
    }
    if (updates.dailyQuota !== undefined) {
      state.config.dailyQuota = updates.dailyQuota;
      saveConfig('dailyQuota', updates.dailyQuota.toString());
    }
    if (updates.dropDelayMs !== undefined) {
      state.config.dropDelayMs = updates.dropDelayMs;
      saveConfig('dropDelayMs', updates.dropDelayMs.toString());
    }
    if (updates.conveyorSpeed !== undefined) {
      state.config.conveyorSpeed = updates.conveyorSpeed;
      saveConfig('conveyorSpeed', updates.conveyorSpeed.toString());
    }
    res.json(state);
  });

  // ─── Dinamik Donanım Cihazları CRUD ───────────────────────────────────────────
  app.post('/api/devices', (req, res) => {
    if (state.systemRunning) return res.status(400).json({ error: 'Sistem çalışırken donanım eklenemez' });
    
    const dev: Device = req.body.device;
    if (!dev || !dev.id) return res.status(400).json({ error: 'Geçersiz cihaz' });
    
    const idx = state.devices.findIndex(d => d.id === dev.id);
    if (idx >= 0) state.devices[idx] = dev;
    else state.devices.push(dev);
    
    saveDevice(dev);
    setupGpioWatchers(); // Pinleri yeniden dinlemeye başla
    
    if (arduino.isConnected && dev.target === 'nano') {
      const typeStr = dev.type === 'valve' || dev.type === 'motor' ? 'valve' : dev.type;
      arduino.sendCommand(`PINCFG:${typeStr}:${dev.pin}`);
    }
    
    res.json(state);
  });

  app.delete('/api/devices/:id', (req, res) => {
    if (state.systemRunning) return res.status(400).json({ error: 'Sistem çalışırken donanım silinemez' });
    
    const id = req.params.id;
    state.devices = state.devices.filter(d => d.id !== id);
    deleteDevice(id);
    setupGpioWatchers();
    res.json(state);
  });

  app.post('/api/devices/:id/trigger', async (req, res) => {
    const id = req.params.id;
    const dev = state.devices.find(d => d.id === id);
    if (!dev) return res.status(404).json({ error: 'Cihaz bulunamadı' });
    
    if (dev.target === 'nano') {
       if (!arduino.isConnected) return res.status(400).json({ error: 'Nano bağlı değil' });
       // Test için OPEN
       await arduino.sendCommand(`OPEN:${dev.pin}`);
       setTimeout(() => { arduino.sendCommand(`CLOSE:${dev.pin}`); }, 1000); // 1 sn sonra kapat testi
    }
    res.json({ success: true });
  });

  app.post('/api/terminal/sandbox/connect', async (req, res) => {
    const { port, baud } = req.body;
    
    if (terminalArduino) await terminalArduino.disconnect();
    
    terminalArduino = new ArduinoManager(port, parseInt(baud), false);
    
    terminalArduino.on('command', (cmd) => {
      logComm('OUT', 'SANDBOX', cmd, 'DEBUG');
    });
    
    terminalArduino.on('data', (line) => {
      logComm('IN', 'SANDBOX', line, line.startsWith('ERR:') ? 'ERROR' : 'INFO');
    });

    // Bağlantı bekleme (opsiyonel simülasyon gecikmesi için)
    setTimeout(() => {
      res.json({ success: true, port, baud });
    }, 500);
  });

  app.post('/api/terminal/sandbox/disconnect', async (req, res) => {
    if (terminalArduino) {
      await terminalArduino.disconnect();
      terminalArduino = null;
    }
    res.json({ success: true });
  });

  app.get('/api/terminal/sandbox/status', (req, res) => {
    if (!terminalArduino) return res.json({ connected: false });
    res.json({
      connected: terminalArduino.isConnected,
      port: terminalArduino.port,
      baud: terminalArduino.baud
    });
  });

  app.post('/api/terminal', async (req, res) => {
    const { target, command } = req.body;
    let response = '';
    if (target === 'nano') {
      if (!terminalArduino || !terminalArduino.isConnected) response = 'ERR: Sandbox Terminal bağlı değil';
      else response = await terminalArduino.sendCommand(command);
    } else {
      response = `bash: ${command}: komut bulunamadı`;
    }
    res.json({ response });
  });

  app.get('/api/history', (_req, res) => res.json(getProductionHistory(100)));
  app.get('/api/alarms', (_req, res) => res.json(getAlarms(100)));
  
  app.post('/api/alarms/:id/resolve', (req, res) => {
    resolveAlarm(parseInt(req.params.id));
    res.json({ ok: true });
  });

  app.get('/api/hardware/ports', async (_req, res) => {
    const rawPorts = await arduino.listPorts();
    const enrichedPorts = rawPorts.map(p => ({
      ...p,
      isLikelyPLC: analyzeLikelyPLC(p)
    }));
    res.json(enrichedPorts);
  });

  // Vite
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ 
      server: { 
        middlewareMode: true,
        watch: {
          ignored: ['**/logs/**']
        }
      }, 
      appType: 'spa' 
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n╔════════════════════════════════════════════════╗`);
    console.log(`║  Palandöken Gazoz Master Sunucu: http://localhost:${PORT}  ║`);
    console.log(`║  Sürücü: ${ARDUINO_PORT}                              ║`);
    console.log(`╚════════════════════════════════════════════════╝\n`);
  });
}

startServer();
