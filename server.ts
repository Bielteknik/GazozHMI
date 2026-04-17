import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { SystemState } from './src/types';
import {
  initDb, loadConfig, saveConfig,
  startCycle, completeCycle, getProductionHistory,
  addAlarm, resolveAlarm, getAlarms,
  getCustomDevices, saveCustomDevice, deleteCustomDevice
} from './src/db';
import { ArduinoManager } from './src/arduino';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Ortam Değişkenleri ───────────────────────────────────────────────────────
const ARDUINO_PORT      = process.env.ARDUINO_PORT      || '/dev/ttyUSB0';
const ARDUINO_BAUDRATE  = parseInt(process.env.ARDUINO_BAUDRATE  || '9600');
// Simülasyon modu varsayılan KAPALI — açmak için ARDUINO_SIMULATION=true
const ARDUINO_SIMULATION = process.env.ARDUINO_SIMULATION === 'true';

// ─── Sistem Durumu (config DB'den yüklendikten sonra doldurulacak) ────────────
let savedConfig: Record<string, string> = {};

// ─── Sistem Durumu ───────────────────────────────────────────────────────────
const state: SystemState = {
  systemRunning: false,
  emergencyStop: false,
  hasError: false,
  valves: Array(10).fill(false),
  motors: [
    { id: 0, name: 'Ana Konveyör Bant',    running: false, speed: 50, direction: 'forward', runningTime: 0 },
    { id: 1, name: 'Giriş Kilidi Motoru',  running: false, speed: 50, direction: 'forward', runningTime: 0, steps: 200 },
    { id: 2, name: 'Çıkış Kilidi Motoru',  running: false, speed: 50, direction: 'forward', runningTime: 0, steps: 200 },
  ],
  sensors: [
    { id: 0, name: 'Giriş Lazer Sensörü', count: 0, active: false, blocked: false },
    { id: 1, name: 'Çıkış Lazer Sensörü', count: 0, active: false, blocked: false },
  ],
  limitSwitches: [
    { id: 'entry_cw',  name: 'Giriş Kilidi İleri Limit (Kapalı)', active: false, type: 'entry', position: 'cw' },
    { id: 'entry_ccw', name: 'Giriş Kilidi Geri Limit (Açık)',    active: true,  type: 'entry', position: 'ccw' },
    { id: 'exit_cw',   name: 'Çıkış Kilidi İleri Limit (Kapalı)', active: true,  type: 'exit',  position: 'cw' },
    { id: 'exit_ccw',  name: 'Çıkış Kilidi Geri Limit (Açık)',   active: false, type: 'exit',  position: 'ccw' },
  ],
  locks: { entry: false, exit: true },
  config: {
    fillWaitTime:   savedConfig.fillWaitTime   ? parseInt(savedConfig.fillWaitTime)         : 3,
    syrupVolume:    savedConfig.syrupVolume     ? parseInt(savedConfig.syrupVolume)           : 40,
    valveFillTimes: savedConfig.valveFillTimes  ? JSON.parse(savedConfig.valveFillTimes)     : Array(10).fill(5),
    targetBottles:  savedConfig.targetBottles   ? parseInt(savedConfig.targetBottles)         : 10,
  },
  process: {
    state: 'WAITING_BOTTLES',
    bottlesInArea: 0,
    timer: 0,
    currentCycleId: undefined,
  },
  hardware: {
    rpi:  { connected: true,  port: 'GPIO',         status: 'Aktif' },
    nano: { connected: false, port: ARDUINO_PORT, baudRate: ARDUINO_BAUDRATE,
            status: ARDUINO_SIMULATION ? 'Simüle Edildi' : 'Bağlanıyor...', simulated: ARDUINO_SIMULATION },
  },
  customDevices: [],
};

// ─── Arduino Yöneticisi ───────────────────────────────────────────────────────
const arduino = new ArduinoManager(ARDUINO_PORT, ARDUINO_BAUDRATE, ARDUINO_SIMULATION);

let arduinoWasConnected = false;

arduino.on('connected', () => {
  state.hardware.nano.connected = true;
  state.hardware.nano.status    = 'Bağlı';
  arduinoWasConnected = true;
  addAlarm('INFO', `Arduino Nano bağlandı: ${ARDUINO_PORT} @ ${ARDUINO_BAUDRATE}`);
});

arduino.on('disconnected', () => {
  state.hardware.nano.connected = false;
  state.hardware.nano.status    = 'Bağlantı Kesildi';
  // Sadece daha önce bağlıysa alarm yaz — ilk bağlantı denemelerinde alarm oluşturma
  if (arduinoWasConnected) {
    state.hasError = true;
    addAlarm('MOTOR_FAULT', 'Arduino Nano bağlantısı beklenmedik şekilde kesildi!');
    arduinoWasConnected = false;
  }
});

// Gerçek Arduino olaylarını state'e yansıt
if (!ARDUINO_SIMULATION) {
  arduino.on('data', (line: string) => {
    if (line.startsWith('SENSOR:0:ON') && state.systemRunning && state.process.state === 'WAITING_BOTTLES') {
      state.sensors[0].active = true;
      state.sensors[0].count++;
      state.process.bottlesInArea++;
    } else if (line.startsWith('SENSOR:1:ON') && state.systemRunning && state.process.state === 'EXITING_BOTTLES') {
      state.sensors[1].active = true;
      state.sensors[1].count++;
      state.process.bottlesInArea = Math.max(0, state.process.bottlesInArea - 1);
    } else if (line.startsWith('LIMIT:entry_cw:ON')) {
      setLimitSwitch('entry_cw', true);  setLimitSwitch('entry_ccw', false);
      state.locks.entry = true;  state.motors[1].running = false;
    } else if (line.startsWith('LIMIT:entry_ccw:ON')) {
      setLimitSwitch('entry_ccw', true);  setLimitSwitch('entry_cw', false);
      state.locks.entry = false;  state.motors[1].running = false;
    } else if (line.startsWith('LIMIT:exit_cw:ON')) {
      setLimitSwitch('exit_cw', true);  setLimitSwitch('exit_ccw', false);
      state.locks.exit = true;  state.motors[2].running = false;
    } else if (line.startsWith('LIMIT:exit_ccw:ON')) {
      setLimitSwitch('exit_ccw', true);  setLimitSwitch('exit_cw', false);
      state.locks.exit = false;  state.motors[2].running = false;
    } else if (line.startsWith('ERR:')) {
      addAlarm('SENSOR_FAULT', `Arduino hatası: ${line}`);
      state.hasError = true;
    } else {
      // Özel donanım verisi kontrolü (örneğin "TEMP:")
      for (const dev of state.customDevices) {
        if (dev.responsePrefix && line.startsWith(dev.responsePrefix)) {
          dev.lastValue = line.substring(dev.responsePrefix.length).trim();
          dev.lastUpdate = new Date().toLocaleTimeString('tr-TR');
          break;
        }
      }
    }
  });
}

function setLimitSwitch(id: string, active: boolean) {
  const sw = state.limitSwitches.find(s => s.id === id);
  if (sw) sw.active = active;
}

// ─── Arduino Senkronu (gerçek mod için lock/valf komutları) ──────────────────
const lastSent = {
  locks:  { entry: state.locks.entry, exit: state.locks.exit },
  valves: [...state.valves],
};

function syncArduino() {
  if (ARDUINO_SIMULATION) return;

  if (state.locks.entry !== lastSent.locks.entry) {
    arduino.sendCommand(state.locks.entry ? 'MOTOR:1:CLOSE' : 'MOTOR:1:OPEN');
    lastSent.locks.entry = state.locks.entry;
  }
  if (state.locks.exit !== lastSent.locks.exit) {
    arduino.sendCommand(state.locks.exit ? 'MOTOR:2:CLOSE' : 'MOTOR:2:OPEN');
    lastSent.locks.exit = state.locks.exit;
  }
  state.valves.forEach((v, i) => {
    if (v !== lastSent.valves[i]) {
      arduino.sendCommand(`VALVE:${i}:${v ? 'ON' : 'OFF'}`);
      lastSent.valves[i] = v;
    }
  });
}

// ─── Simülasyon Yardımcısı ────────────────────────────────────────────────────
function simulateLockMotor(motorId: number, type: 'entry' | 'exit', targetState: 'open' | 'closed') {
  const motor     = state.motors[motorId];
  const cwSwitch  = state.limitSwitches.find(s => s.type === type && s.position === 'cw')!;
  const ccwSwitch = state.limitSwitches.find(s => s.type === type && s.position === 'ccw')!;

  if (targetState === 'closed') {
    if (!cwSwitch.active) {
      motor.running   = true;
      motor.direction = 'forward';
      ccwSwitch.active = false;
      if (Math.random() > 0.5) { cwSwitch.active = true; motor.running = false; state.locks[type] = true; }
    } else {
      motor.running = false; state.locks[type] = true;
    }
  } else {
    if (!ccwSwitch.active) {
      motor.running   = true;
      motor.direction = 'reverse';
      cwSwitch.active = false;
      if (Math.random() > 0.5) { ccwSwitch.active = true; motor.running = false; state.locks[type] = false; }
    } else {
      motor.running = false; state.locks[type] = false;
    }
  }
}

// ─── Durum Makinesi Tik ───────────────────────────────────────────────────────
const TICK_RATE = 500;

setInterval(() => {
  // Sensör aktif sinyallerini sıfırla
  state.sensors.forEach(s => { if (!s.blocked) s.active = false; });

  if (state.systemRunning && !state.emergencyStop) {
    // Motor çalışma süresi
    state.motors.forEach(m => { if (m.running) m.runningTime += TICK_RATE / 1000; });

    switch (state.process.state) {

      case 'WAITING_BOTTLES':
        simulateLockMotor(1, 'entry', 'open');
        simulateLockMotor(2, 'exit',  'closed');
        state.valves.fill(false);

        if (!state.locks.entry) {
          state.motors[0].running = true;
        } else {
          state.motors[0].running = false;
        }

        if (state.motors[0].running && state.process.bottlesInArea < state.config.targetBottles) {
          if (Math.random() > 0.3) {
            state.sensors[0].count++;
            state.sensors[0].active = true;
            state.process.bottlesInArea++;
          }
        }

        if (state.process.bottlesInArea >= state.config.targetBottles) {
          state.motors[0].running = false;
          state.process.state     = 'PRE_FILL_WAIT';
          state.process.timer     = state.config.fillWaitTime;
          // Üretim döngüsünü DB'de başlat
          state.process.currentCycleId = startCycle();
        }
        break;

      case 'PRE_FILL_WAIT':
        simulateLockMotor(1, 'entry', 'closed');
        if (state.locks.entry) {
          state.process.timer -= TICK_RATE / 1000;
          if (state.process.timer <= 0) {
            state.process.state = 'FILLING';
            state.process.timer = 0;
          }
        }
        break;

      case 'FILLING':
        state.process.timer += TICK_RATE / 1000;
        for (let i = 0; i < state.config.targetBottles; i++) {
          if (i < state.process.bottlesInArea && state.process.timer < state.config.valveFillTimes[i]) {
            state.valves[i] = true;
          } else {
            state.valves[i] = false;
          }
        }
        {
          const active = state.config.valveFillTimes.slice(0, state.process.bottlesInArea);
          const maxTime = active.length > 0 ? Math.max(...active) : 0;
          if (state.process.timer >= maxTime) {
            state.valves.fill(false);
            state.process.state = 'POST_FILL_WAIT';
            state.process.timer = 0;
          }
        }
        break;

      case 'POST_FILL_WAIT':
        state.process.timer += TICK_RATE / 1000;
        if (state.process.timer >= 1.0) {
          state.process.state = 'EXITING_BOTTLES';
        }
        break;

      case 'EXITING_BOTTLES':
        simulateLockMotor(1, 'entry', 'closed');
        simulateLockMotor(2, 'exit',  'open');

        if (!state.locks.exit) {
          state.motors[0].running = true;
          if (state.process.bottlesInArea > 0 && Math.random() > 0.3) {
            state.sensors[1].count++;
            state.sensors[1].active = true;
            state.process.bottlesInArea--;
          }
          if (state.process.bottlesInArea <= 0) {
            state.motors[0].running = false;
            // Döngüyü tamamla
            if (state.process.currentCycleId) {
              completeCycle(
                state.process.currentCycleId,
                'completed',
                state.sensors[0].count,
                state.sensors[1].count,
              );
              state.process.currentCycleId = undefined;
            }
            state.process.state = 'WAITING_BOTTLES';
          }
        }
        break;
    }

    // Gerçek Arduino modunda lock/valf komutlarını gönder
    syncArduino();

    // Özel donanım otomatik polling
    if (!ARDUINO_SIMULATION && arduino.isConnected) {
      const now = Date.now();
      state.customDevices.forEach(dev => {
        if (dev.autoMode && dev.command && dev.pollIntervalSec > 0) {
          // Bir nevi debounce, her loop'ta saati tutmak yerine basitce lastUpdate + interval e bakılır
          // Fakat lastUpdate bir string. Bir 'lastPollMs' alanımız yok. Bunu state.customDevices üzerinde geçici olarak tutalım.
          const devState = dev as any;
          if (!devState._lastPollMs || now - devState._lastPollMs >= dev.pollIntervalSec * 1000) {
            arduino.sendCommand(dev.command);
            devState._lastPollMs = now;
          }
        }
      });
    }

  } else if (!state.systemRunning) {
    state.valves.fill(false);
    state.motors.forEach(m => { m.running = false; });
  }
}, TICK_RATE);

// ─── Express Sunucu ───────────────────────────────────────────────────────────
async function startServer() {
  // ── DB Başlatma ───────────────────────────────────────────────────────────────
  await initDb();
  // Özel cihazları DB'den yükle
  state.customDevices = getCustomDevices();
  // Kalıcı config yükle
  const saved = loadConfig();
  if (saved.fillWaitTime)   state.config.fillWaitTime   = parseInt(saved.fillWaitTime);
  if (saved.syrupVolume)    state.config.syrupVolume    = parseInt(saved.syrupVolume);
  if (saved.valveFillTimes) state.config.valveFillTimes = JSON.parse(saved.valveFillTimes);
  if (saved.targetBottles)  state.config.targetBottles  = parseInt(saved.targetBottles);

  const app  = express();
  const PORT = parseInt(process.env.PORT || '3000');

  app.use(express.json());

  // ── Temel Durum ──────────────────────────────────────────────────────────────
  app.get('/api/state', (_req, res) => {
    // Nano durumunu gerçek zamanlı yansıt
    state.hardware.nano.connected = arduino.isConnected;
    res.json(state);
  });

  // ── Acil Stop ─────────────────────────────────────────────────────────────────
  app.post('/api/estop', (req, res) => {
    state.emergencyStop = req.body.active;
    if (state.emergencyStop) {
      state.systemRunning = false;
      state.valves.fill(false);
      state.motors.forEach(m => { m.running = false; });
      state.locks.entry = true;
      state.locks.exit  = true;
      // DB'de alarm kaydet
      addAlarm('ESTOP', 'Acil stop butonu etkinleştirildi!');
      // Aktif döngüyü kes
      if (state.process.currentCycleId) {
        completeCycle(state.process.currentCycleId, 'estop',
          state.sensors[0].count, state.sensors[1].count);
        state.process.currentCycleId = undefined;
      }
      // Arduino'ya gönder
      arduino.sendCommand('ESTOP');
    } else {
      state.hasError = false;
      arduino.sendCommand('RESET');
    }
    res.json(state);
  });

  // ── Sistem Başlat/Durdur ──────────────────────────────────────────────────────
  app.post('/api/system', (req, res) => {
    if (state.emergencyStop) return res.status(400).json({ error: 'Acil stop aktif' });
    const wasRunning = state.systemRunning;
    state.systemRunning = req.body.running;
    // Sistem duruyorsa aktif döngüyü kaydet
    if (wasRunning && !state.systemRunning && state.process.currentCycleId) {
      completeCycle(state.process.currentCycleId, 'interrupted',
        state.sensors[0].count, state.sensors[1].count);
      state.process.currentCycleId = undefined;
    }
    res.json(state);
  });

  // ── Konfigürasyon ─────────────────────────────────────────────────────────────
  app.post('/api/config', (req, res) => {
    if (state.systemRunning) return res.status(400).json({ error: 'Sistem çalışırken ayar değiştirilemez' });

    const { fillWaitTime, syrupVolume, valveFillTimes, targetBottles } = req.body;

    if (fillWaitTime  !== undefined) { state.config.fillWaitTime  = fillWaitTime;  saveConfig('fillWaitTime',   String(fillWaitTime)); }
    if (syrupVolume   !== undefined) { state.config.syrupVolume   = syrupVolume;   saveConfig('syrupVolume',    String(syrupVolume)); }
    if (valveFillTimes !== undefined) { state.config.valveFillTimes = valveFillTimes; saveConfig('valveFillTimes', JSON.stringify(valveFillTimes)); }
    if (targetBottles !== undefined) { state.config.targetBottles = targetBottles; saveConfig('targetBottles',  String(targetBottles)); }

    res.json(state);
  });

  // ── Valf Kontrolü ─────────────────────────────────────────────────────────────
  app.post('/api/valves/:id', (req, res) => {
    if (state.emergencyStop) return res.status(400).json({ error: 'Acil stop aktif' });
    const id = parseInt(req.params.id);
    if (id >= 0 && id < 10) {
      state.valves[id] = req.body.active;
      if (!ARDUINO_SIMULATION) arduino.sendCommand(`VALVE:${id}:${req.body.active ? 'ON' : 'OFF'}`);
    }
    res.json(state);
  });

  // ── Motor Kontrolü ────────────────────────────────────────────────────────────
  app.post('/api/motors/:id', (req, res) => {
    if (state.emergencyStop) return res.status(400).json({ error: 'Acil stop aktif' });
    const id = parseInt(req.params.id);
    if (id >= 0 && id < state.motors.length) {
      if (req.body.running   !== undefined) state.motors[id].running   = req.body.running;
      if (req.body.speed     !== undefined) state.motors[id].speed     = req.body.speed;
      if (req.body.direction !== undefined) state.motors[id].direction = req.body.direction;
      if (req.body.steps     !== undefined) state.motors[id].steps     = req.body.steps;
    }
    res.json(state);
  });

  // ── Sensör Sıfırla ────────────────────────────────────────────────────────────
  app.post('/api/sensors/reset', (_req, res) => {
    state.sensors.forEach(s => { s.count = 0; });
    res.json(state);
  });

  // ── Sensör Engel Testi ────────────────────────────────────────────────────────
  app.post('/api/sensors/toggle', (req, res) => {
    if (state.systemRunning) return res.status(400).json({ error: 'Sistem çalışırken test yapılamaz' });
    const { id, blocked } = req.body;
    const sensor = state.sensors.find(s => s.id === id);
    if (sensor) {
      if (blocked && !sensor.blocked) { sensor.count++; sensor.active = true; }
      else if (!blocked && sensor.blocked) { sensor.active = false; }
      sensor.blocked = blocked;
    }
    res.json(state);
  });

  // ── Kilit Testi ───────────────────────────────────────────────────────────────
  app.post('/api/locks/toggle', (req, res) => {
    if (state.systemRunning) return res.status(400).json({ error: 'Sistem çalışırken test yapılamaz' });
    const { type, open } = req.body;
    if (type === 'entry' || type === 'exit') {
      state.locks[type] = !open;
      const cw  = state.limitSwitches.find(s => s.type === type && s.position === 'cw');
      const ccw = state.limitSwitches.find(s => s.type === type && s.position === 'ccw');
      if (cw && ccw) { cw.active = !open; ccw.active = open; }
      // Arduino komut gönder
      if (!ARDUINO_SIMULATION) {
        const motorId = type === 'entry' ? 1 : 2;
        arduino.sendCommand(`MOTOR:${motorId}:${open ? 'OPEN' : 'CLOSE'}`);
      }
    }
    res.json(state);
  });

  // ── Valf Dolum Süresi Testi ───────────────────────────────────────────────────
  app.post('/api/valves/test', (req, res) => {
    if (state.systemRunning) return res.status(400).json({ error: 'Sistem çalışırken test yapılamaz' });
    const { index } = req.body;
    if (index >= 0 && index < state.valves.length) {
      state.valves[index] = true;
      if (!ARDUINO_SIMULATION) arduino.sendCommand(`VALVE:${index}:ON`);
      const duration = state.config.valveFillTimes[index] * 1000;
      setTimeout(() => {
        state.valves[index] = false;
        if (!ARDUINO_SIMULATION) arduino.sendCommand(`VALVE:${index}:OFF`);
      }, duration);
    }
    res.json(state);
  });

  // ── Terminal ──────────────────────────────────────────────────────────────────
  app.post('/api/terminal', async (req, res) => {
    const { target, command } = req.body;
    let response = '';

    if (target === 'nano') {
      if (!ARDUINO_SIMULATION && !arduino.isConnected) {
        response = 'ERR: Arduino bağlı değil';
      } else {
        response = await arduino.sendCommand(command);
      }
    } else if (target === 'rpi') {
      // RPi: basit komut simülasyonu (gerçek GPIO komutları buraya eklenebilir)
      const cmd = command.toLowerCase().trim();
      if      (cmd === 'status') response = `RPi: Çalışıyor | Heap: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB | PID: ${process.pid}`;
      else if (cmd === 'ping')   response = 'pong';
      else if (cmd === 'uptime') response = `Süreç: ${Math.round(process.uptime())}s`;
      else                       response = `bash: ${command}: komut bulunamadı`;
    }

    res.json({ response });
  });

  // ── Donanım Konfigürasyonu ────────────────────────────────────────────────────
  app.post('/api/hardware/config', (req, res) => {
    const { target, config: cfg } = req.body;
    if (target === 'rpi')  state.hardware.rpi  = { ...state.hardware.rpi,  ...cfg };
    if (target === 'nano') state.hardware.nano = { ...state.hardware.nano, ...cfg };
    res.json(state);
  });

  // ── Üretim Geçmişi ────────────────────────────────────────────────────────────
  app.get('/api/history', (_req, res) => {
    res.json(getProductionHistory(100));
  });

  // ── Alarm Kayıtları ───────────────────────────────────────────────────────────
  app.get('/api/alarms', (_req, res) => {
    res.json(getAlarms(100));
  });

  app.post('/api/alarms/:id/resolve', (req, res) => {
    resolveAlarm(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ── Mevcut Serial Portlar ─────────────────────────────────────────────────────
  app.get('/api/hardware/ports', async (_req, res) => {
    const ports = await arduino.listPorts();
    res.json(ports);
  });

  // ─── Özel Donanım (Custom Hardware) ──────────────────────────────────────────
  app.post('/api/custom-hardware', (req, res) => {
    const dev = req.body.device;
    if (!dev || !dev.id) return res.status(400).json({ error: 'Geçersiz parametreler' });
    const existing = state.customDevices.findIndex(d => d.id === dev.id);
    if (existing >= 0) state.customDevices[existing] = dev;
    else state.customDevices.push(dev);
    saveCustomDevice(dev);
    res.json(state);
  });

  app.delete('/api/custom-hardware/:id', (req, res) => {
    const id = req.params.id;
    state.customDevices = state.customDevices.filter(d => d.id !== id);
    deleteCustomDevice(id);
    res.json(state);
  });

  app.post('/api/custom-hardware/:id/send', async (req, res) => {
    const id = req.params.id;
    const dev = state.customDevices.find(d => d.id === id);
    if (!dev) return res.status(404).json({ error: 'Donanım bulunamadı' });
    if (!arduino.isConnected && !ARDUINO_SIMULATION) {
      return res.status(400).json({ error: 'Arduino bağlı değil' });
    }
    const cmd = req.body.command || dev.command;
    if (cmd) {
      if (!ARDUINO_SIMULATION) await arduino.sendCommand(cmd);
      else console.log(`[SIMULATION] Gönderildi: ${cmd}`);
    }
    res.json({ success: true, command: cmd });
  });

  // ─── Vite Entegrasyonu ────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n╔══════════════════════════════════╗`);
    console.log(`║  GazozHMI Sunucu: http://localhost:${PORT}  ║`);
    console.log(`║  Arduino: ${ARDUINO_SIMULATION ? 'SİMÜLASYON' : ARDUINO_PORT}${ARDUINO_SIMULATION ? '         ' : '       '}  ║`);
    console.log(`╚══════════════════════════════════╝\n`);
  });
}

startServer();
