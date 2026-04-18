/**
 * SQLite Veri Katmanı (sql.js — WebAssembly tabanlı, derleme gerektirmez)
 *
 * Üretim döngüleri, alarm kayıtları ve kalıcı konfigürasyonu saklar.
 * DB dosyası: DB_PATH env değişkeni veya ./gazoz.db
 *
 * NOT: sql.js tamamen in-memory çalışır; her değişiklikte diske yazar.
 *      RPi'de gerçek donanım için better-sqlite3 da kullanılabilir
 *      (Node 18/20 LTS ile sorunsuz derlenir).
 */

import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { ProductionCycle, Alarm } from './types';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'gazoz.db');

let db: Database;

// ─── Başlatma (async) ─────────────────────────────────────────────────────────
export async function initDb(): Promise<void> {
  const SQL = await initSqlJs();

  // Varolan DB dosyasını yükle veya yeni oluştur
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  // Tabloları oluştur
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS production_cycles (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      completed_at TEXT,
      bottles_in   INTEGER NOT NULL DEFAULT 0,
      bottles_out  INTEGER NOT NULL DEFAULT 0,
      status       TEXT    NOT NULL DEFAULT 'running'
    );

    CREATE TABLE IF NOT EXISTS alarms (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      type        TEXT    NOT NULL,
      message     TEXT    NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS devices (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      type            TEXT NOT NULL,
      role            TEXT NOT NULL,
      target          TEXT NOT NULL,
      pin             TEXT NOT NULL,
      fillDurationMs  INTEGER,
      manufacturer    TEXT,
      model           TEXT,
      serialNumber    TEXT,
      description     TEXT,
      installDate     TEXT,
      lastMaintenance TEXT,
      specs           TEXT,
      inverted        INTEGER DEFAULT 0,
      category        TEXT
    );
  `);

  // Mevcut veritabanları için sütun ekleme (Migration)
  const columnsToAdd = [
    { name: 'manufacturer',    type: 'TEXT' },
    { name: 'model',           type: 'TEXT' },
    { name: 'serialNumber',    type: 'TEXT' },
    { name: 'description',     type: 'TEXT' },
    { name: 'installDate',     type: 'TEXT' },
    { name: 'lastMaintenance', type: 'TEXT' },
    { name: 'specs',           type: 'TEXT' },
    { name: 'inverted',        type: 'INTEGER DEFAULT 0' },
    { name: 'category',        type: 'TEXT' }
  ];

  for (const col of columnsToAdd) {
    try {
      db.run(`ALTER TABLE devices ADD COLUMN ${col.name} ${col.type}`);
    } catch {
      // Sütun zaten varsa hata verir, görmezden gel
    }
  }

  persist();
  console.log(`[DB] Veritabanı hazır: ${DB_PATH}`);
}

// Diske yaz (her değişiklikte çağrılır)
function persist() {
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('[DB] Disk yazma hatası:', e);
  }
}

// ─── Konfigürasyon ─────────────────────────────────────────────────────────────
export function loadConfig(): Record<string, string> {
  const result = db.exec('SELECT key, value FROM config');
  if (!result.length) return {};
  const { columns, values } = result[0];
  return Object.fromEntries(values.map(row => [String(row[0]), String(row[1])]));
}

export function saveConfig(key: string, value: string): void {
  db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, value]);
  persist();
}

// ─── Üretim Döngüleri ──────────────────────────────────────────────────────────
export function startCycle(): number {
  db.run("INSERT INTO production_cycles (status) VALUES ('running')");
  const res = db.exec('SELECT last_insert_rowid()');
  persist();
  return Number(res[0].values[0][0]);
}

export function completeCycle(
  id: number,
  status: 'completed' | 'interrupted' | 'estop',
  bottlesIn: number,
  bottlesOut: number,
): void {
  db.run(
    `UPDATE production_cycles
     SET completed_at = datetime('now', 'localtime'), status = ?, bottles_in = ?, bottles_out = ?
     WHERE id = ?`,
    [status, bottlesIn, bottlesOut, id],
  );
  persist();
}

export function getProductionHistory(limit = 100): ProductionCycle[] {
  const res = db.exec(`SELECT * FROM production_cycles ORDER BY id DESC LIMIT ${limit}`);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(row =>
    Object.fromEntries(columns.map((c, i) => [c, row[i]])) as unknown as ProductionCycle
  );
}

// ─── Alarmlar ──────────────────────────────────────────────────────────────────
export function addAlarm(type: string, message: string): number {
  db.run('INSERT INTO alarms (type, message) VALUES (?, ?)', [type, message]);
  const res = db.exec('SELECT last_insert_rowid()');
  persist();
  console.log(`[ALARM] [${type}] ${message}`);
  return Number(res[0].values[0][0]);
}

export function resolveAlarm(id: number): void {
  db.run("UPDATE alarms SET resolved_at = datetime('now', 'localtime') WHERE id = ?", [id]);
  persist();
}

export function getAlarms(limit = 100): Alarm[] {
  const res = db.exec(`SELECT * FROM alarms ORDER BY id DESC LIMIT ${limit}`);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(row =>
    Object.fromEntries(columns.map((c, i) => [c, row[i]])) as unknown as Alarm
  );
}

// ─── Ekli Donanımlar (Devices) ─────────────────────────────────────────────────
import { Device } from './types';

export function getDevices(): Device[] {
  const res = db.exec('SELECT * FROM devices');
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(row => {
    const obj = Object.fromEntries(columns.map((c, i) => [c, row[i]]));
    return {
      ...obj,
      active: false,
      count: 0,
      lastUpdate: null,
    } as unknown as Device;
  });
}

export function saveDevice(device: Device): void {
  db.run(`
    INSERT OR REPLACE INTO devices 
    (id, name, type, role, target, pin, fillDurationMs, 
     manufacturer, model, serialNumber, description, installDate, 
     lastMaintenance, specs, inverted, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    device.id, device.name, device.type, device.role,
    device.target, device.pin, device.fillDurationMs || null,
    device.manufacturer || null, device.model || null, device.serialNumber || null,
    device.description || null, device.installDate || null, device.lastMaintenance || null,
    device.specs || null, device.inverted ? 1 : 0, device.category || null
  ]);
  persist();
}

export function deleteDevice(id: string): void {
  db.run('DELETE FROM devices WHERE id = ?', [id]);
  persist();
}

