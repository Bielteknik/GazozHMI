import React, { useEffect, useState, useRef } from 'react';
import {
  Activity, Settings, AlertTriangle, Droplet, Cpu, ScanLine,
  Play, Square, Lock, Unlock, Timer, Terminal, History, Bell,
  PlusCircle, Trash2, Cpu as Microchip, LayoutDashboard, Map as MapIcon, RefreshCw, Layers, Shield
} from 'lucide-react';
import { SystemState, Device, SystemNotification } from './types';

// Design Tokens
const RADIUS = "rounded-lg"; // 8px
const OUTER_GAP = "p-[10px]"; // 10px

export default function App() {
  const [state, setState] = useState<SystemState | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'system'>('dashboard');

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res  = await fetch('/api/state');
        const data = await res.json();
        setState(data);
      } catch (e) { console.error('State fetch hatası', e); }
    };
    fetchState();
    const iv = setInterval(fetchState, 500);
    return () => clearInterval(iv);
  }, []);

  const apiCall = async (endpoint: string, payload: Record<string, unknown> = {}, method: string = 'POST') => {
    try {
      const res  = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    method !== 'GET' ? JSON.stringify(payload) : undefined,
      });
      const data = await res.json();
      if (!data.error) setState(data);
    } catch (e) { console.error(`API hatası: ${endpoint}`, e); }
  };

  if (!state) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
      <RefreshCw className="w-12 h-12 animate-spin text-blue-500" />
      <span className="text-[10px] font-bold text-slate-400 mt-4 tracking-[0.3em] uppercase">Sistem Yapılandırılıyor</span>
    </div>
  );

  return (
    <div className={`flex flex-col h-screen w-full bg-[#f1f5f9] font-sans overflow-hidden select-none ${OUTER_GAP}`}>
      {/* ─── MAIN CONTAINER (8px Radius) ─── */}
      <div className={`flex-1 flex flex-col bg-white shadow-2xl border border-slate-200 overflow-hidden ${RADIUS}`}>
        
        {/* ─── PREMIUM HEADER ─── */}
        <header className="h-[70px] border-b border-slate-100 flex items-center justify-between px-6 shrink-0 bg-white/80 backdrop-blur-md z-20">
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-100">
                <Droplet className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg text-slate-800 tracking-tight leading-none uppercase">Palandöken Gazoz</span>
              </div>
            </div>
            
            <nav className="flex gap-1 h-full">
              <TabLink active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard className="w-4 h-4" />} label="ANA PANEL" />
              <TabLink active={activeTab === 'system'}    onClick={() => setActiveTab('system')} icon={<Settings className="w-4 h-4" />} label="AYARLAR" />
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {state.systemRunning && (
              <div className="flex items-center gap-2 mr-2">
                <button 
                  onClick={() => apiCall('/api/pause', { paused: !state.paused })}
                  className={`h-11 px-4 ${RADIUS} font-bold text-xs border-2 transition-all flex items-center gap-2 ${
                    state.paused 
                      ? 'bg-blue-600 text-white border-blue-700 shadow-lg shadow-blue-100' 
                      : 'bg-white text-blue-600 border-blue-100 hover:bg-blue-50'
                  }`}
                  title={state.paused ? 'Sistemi Devam Ettir' : 'Sistemi Geçici Olarak Durdur (Güvenli Bekleme)'}
                >
                  {state.paused ? <Play className="w-4 h-4 fill-white" /> : <Timer className="w-4 h-4" />}
                  <span>{state.paused ? 'DEVAM ET' : 'DURAKLAT'}</span>
                </button>
                <button 
                  onClick={() => { if(confirm('Süreç iptal edilecek ve tüm valfler kapatılacak. Emin misiniz?')) apiCall('/api/cancel'); }}
                  className={`h-11 px-4 ${RADIUS} font-bold text-xs bg-white text-slate-500 border-2 border-slate-100 hover:text-slate-800 hover:border-slate-300 transition-all flex items-center gap-2`}
                  title="Mevcut üretimi iptal et ve BAŞA dön"
                >
                  <Square className="w-3.5 h-3.5" /> İPTAL
                </button>
              </div>
            )}
            <SystemToggle 
              running={state.systemRunning} 
              disabled={state.emergencyStop || state.process.state === 'WASHING'} 
              onClick={() => apiCall('/api/system', { running: !state.systemRunning })}
            />
            <button 
              onClick={() => apiCall('/api/estop', { active: !state.emergencyStop })}
              className={`h-11 px-6 ${RADIUS} font-bold text-xs border-2 transition-all flex items-center gap-2 ${
                state.emergencyStop 
                  ? 'bg-rose-500 text-white border-rose-600 animate-pulse' 
                  : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4" /> ACİL STOP
            </button>
          </div>
        </header>

        {/* ─── CONTENT AREA ─── */}
        <main className="flex-1 min-h-0 relative bg-[#fcfcfd]">
          {state.emergencyStop && <EmergencyShutter onReset={() => apiCall('/api/estop', { active: false })} />}
          
          {/* Global Notifications (Toast Overlay) */}
          <div className="absolute top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
            {state.notifications?.map(n => (
              <NotificationToast key={n.id} notification={n} />
            ))}
          </div>

          {activeTab === 'dashboard' && <DashboardView state={state} apiCall={apiCall} />}
          {activeTab === 'system'    && <SettingsView  state={state} apiCall={apiCall} />}
        </main>
      </div>
    </div>
  );
}

// ─── UI COMPONENTS ───────────────────────────────────

function TabLink({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: any, label: string; }) {
  return (
    <button onClick={onClick} className={`px-6 h-[70px] flex items-center gap-2 text-xs font-black tracking-widest transition-all relative ${active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
      {icon}<span>{label}</span>
      {active && <div className="absolute bottom-0 left-4 right-4 h-1 bg-blue-500 rounded-t-full" />}
    </button>
  );
}

function SystemToggle({ running, disabled, onClick }: { running: boolean; disabled: boolean; onClick: () => void; }) {
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`h-11 px-6 ${RADIUS} font-black text-xs flex items-center gap-3 transition-all shadow-md ${
        disabled ? 'bg-slate-100 text-slate-300 pointer-events-none' :
        running ? 'bg-amber-500 text-white shadow-amber-100 hover:bg-amber-600 active:scale-95' :
                  'bg-emerald-500 text-white shadow-emerald-100 hover:bg-emerald-600 active:scale-95'
      }`}
    >
      {running ? <Square className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white" />}
      <span>{running ? 'HATTİ DURDUR' : 'ÜRETİME BAŞLA'}</span>
    </button>
  );
}

// ─── DASHBOARD VIEW ──────────────────────────────────

function DashboardView({ state, apiCall }: { state: SystemState; apiCall: any }) {
  const [subTab, setSubTab] = useState<'console' | 'map' | 'terminal'>('console');

  return (
    <div className="h-full flex flex-col">
      <div className="flex bg-white border-b border-slate-100">
        <SubTab active={subTab === 'console'}  onClick={() => setSubTab('console')}  icon={<Activity className="w-3.5 h-3.5" />} label="CANLI KONSOL" />
        <SubTab active={subTab === 'map'}      onClick={() => setSubTab('map')}      icon={<MapIcon className="w-3.5 h-3.5" />} label="DONANIM ENVANTERİ" />
        <SubTab active={subTab === 'terminal'} onClick={() => setSubTab('terminal')} icon={<Terminal className="w-3.5 h-3.5" />} label="PLC DRIVER TERMİNAL" />
      </div>
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {subTab === 'console'  && <ConsoleView state={state} />}
        {subTab === 'map'      && <HardwareList state={state} />}
        {subTab === 'terminal' && <PLCTerminalView state={state} apiCall={apiCall} />}
      </div>
    </div>
  );
}

const pStateMap: Record<string, string> = {
  IDLE: 'Beklemede', WAITING_ENTRY: 'Giriş Sayımı', FILLING: 'Dolum Aktif', WAITING_EXIT: 'Çıkış Akışı', WASHING: 'CIP Yıkama'
};

function AnalyticCard({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <div className={`p-4 bg-slate-50/50 border border-slate-100 ${RADIUS} flex items-center justify-between`}>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</span>
        <span className="text-2xl font-extrabold text-slate-800 font-mono tracking-tight">{value}</span>
      </div>
      <div className="p-3 bg-white rounded-lg shadow-sm border border-slate-100">{icon}</div>
    </div>
  );
}

function SubTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; }) {
  return (
    <button onClick={onClick} className={`h-11 px-4 flex items-center gap-2 font-black text-[10px] tracking-widest transition-all relative ${active ? 'text-slate-900' : 'text-slate-300 hover:text-slate-500'}`}>
      {icon}
      <span>{label}</span>
      {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
    </button>
  );
}

// ─── CONSOLE VIEW ───────────────────────────────────────────────────────────

type LogLevel = 'SYS' | 'INFO' | 'OK' | 'WARN' | 'ERROR';
interface LogEntry { id: number; ts: string; level: LogLevel; msg: string; }
let _logId = 0;
function mkLog(level: LogLevel, msg: string): LogEntry {
  const d = new Date();
  const ts = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  return { id: _logId++, ts, level, msg };
}

const LEVEL_COLOR: Record<LogLevel, string> = {
  SYS: 'text-slate-400', INFO: 'text-blue-500', OK: 'text-emerald-500', WARN: 'text-amber-500', ERROR: 'text-rose-500'
};
const LOG_TEXT: Record<LogLevel, string> = {
  SYS: 'text-slate-500', INFO: 'text-slate-700', OK: 'text-slate-700 font-bold', WARN: 'text-amber-700 font-bold', ERROR: 'text-rose-600 font-black'
};

function ConsoleView({ state }: { state: SystemState }) {
  const [logs, setLogs] = useState<LogEntry[]>(() => [mkLog('SYS', 'GazozHMI konsol başlatıldı.')]);
  const prevRef   = useRef<SystemState | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (!prev) { prevRef.current = state; return; }
    const entries: LogEntry[] = [];

    if (prev.systemRunning !== state.systemRunning)
      entries.push(mkLog(state.systemRunning ? 'OK' : 'WARN',
        state.systemRunning ? 'Üretim hattı BAŞLATILDI.' : 'Üretim hattı DURDURULDU.'));

    if (!prev.emergencyStop && state.emergencyStop)
      entries.push(mkLog('ERROR', '!!! ACİL STOP AKTİF — TÜM ÇIKIŞLAR KESİLDİ !!!'));
    if (prev.emergencyStop && !state.emergencyStop)
      entries.push(mkLog('OK', 'Acil stop sıfırlandı. Sistem güvenli.'));

    if (prev.process.state !== state.process.state)
      entries.push(mkLog('INFO', `Proses fazı: ${prev.process.state} → ${state.process.state}`));

    if (prev.paused !== state.paused)
      entries.push(mkLog(state.paused ? 'WARN' : 'OK',
        state.paused ? 'Sistem kullanıcı tarafından DURAKLATILDI.' : 'Sistem DEVAM ETTİRİLİYOR.'));

    if (prev.process.bottlesInArea !== state.process.bottlesInArea) {
      const d = state.process.bottlesInArea - prev.process.bottlesInArea;
      entries.push(mkLog('INFO',
        d > 0
          ? `Ürün algılandı. Hat: ${state.process.bottlesInArea}/${state.process.targetBottles}`
          : `Ürün çıktı.   Hat: ${state.process.bottlesInArea}/${state.process.targetBottles}`
      ));
    }

    state.devices.forEach(dev => {
      const p = prev.devices.find(d => d.id === dev.id);
      if (p && p.active !== dev.active)
        entries.push(mkLog(
          dev.type === 'laser_sensor' ? (dev.active ? 'WARN' : 'OK') : (dev.active ? 'OK' : 'INFO'),
          `[${dev.target === 'nano' ? 'PLC DRIVER' : dev.target.toUpperCase()}:${dev.pin}] ${dev.name} → ${dev.active ? 'AKTİF' : 'PASİF'}`
        ));
    });

    if (entries.length > 0)
      setLogs(prev => [...prev.slice(-300), ...entries]);

    prevRef.current = state;
  }, [state]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const valves    = state.devices.filter(d => d.type === 'valve').sort((a,b) => a.role.localeCompare(b.role));
  const entryLock = state.devices.find(d => d.role === 'entry_lock');
  const exitLock  = state.devices.find(d => d.role === 'exit_lock');
  const inSensor  = state.devices.find(d => d.role === 'entry_laser');
  const outSensor = state.devices.find(d => d.role === 'exit_laser');

  return (
    <div className="absolute inset-0 bg-slate-200 font-mono flex flex-col overflow-hidden text-slate-800 shadow-inner">
      
      {/* ── TOP STATUS BAR ── */}
      <div className="px-6 py-2.5 border-b border-slate-300 bg-slate-100 flex gap-6 items-center shrink-0 flex-wrap shadow-sm relative z-10">
        <div className="flex gap-2.5 items-center">
          <span className="text-[10px] text-slate-500 tracking-widest font-bold">PROSES</span>
          <span className={`text-[11px] font-black border rounded px-2.5 py-0.5 tracking-wider uppercase ${state.process.state === 'FILLING' ? 'text-emerald-700 border-emerald-400 bg-emerald-100' : state.process.state === 'WAITING_EXIT' ? 'text-blue-700 border-blue-400 bg-blue-100' : state.process.state === 'WASHING' ? 'text-purple-700 border-purple-400 bg-purple-100' : 'text-slate-600 border-slate-300 bg-slate-200'}`}>
            {state.process.state}
          </span>
        </div>
        <div className="w-px h-5 bg-slate-300" />
        <KVPair k="HATTA" v={`${state.process.bottlesInArea} / ${state.process.targetBottles}`} textColor="text-slate-800" />
        <div className="w-px h-5 bg-slate-300" />
        <KVPair k="GİRİŞ SAYACI" v={String(inSensor?.count ?? 0)} textColor="text-emerald-700" />
        <div className="w-px h-5 bg-slate-300" />
        <KVPair k="ÇIKIŞ SAYACI" v={String(outSensor?.count ?? 0)} textColor="text-blue-700" />
        
        <div className="ml-auto flex gap-4">
          {state.paused && <span className="text-[10px] font-black tracking-widest text-blue-600 flex items-center gap-1.5 animate-pulse"><Timer className="w-3.5 h-3.5"/>DURAKLATILDI</span>}
          {state.systemRunning && !state.paused && <span className="text-[10px] font-black tracking-widest text-emerald-600 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>ÇALIŞIYOR</span>}
          {state.emergencyStop && <span className="text-[10px] font-black tracking-widest text-rose-600 flex items-center gap-1.5 animate-pulse"><AlertTriangle className="w-3.5 h-3.5"/>ACİL STOP</span>}
          {!state.systemRunning && !state.emergencyStop && <span className="text-[10px] font-black tracking-widest text-slate-500 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full border-2 border-slate-500"/>BEKLEMEDE</span>}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        
        {/* ── LEFT: DEVICE STATUS ── */}
        <div className="w-[38%] md:w-[35%] border-r border-slate-300 flex flex-col overflow-hidden shrink-0 bg-slate-100 relative z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.08)]">
          <SectionHeader text={`CİHAZ LİSTESİ (${state.devices.length})`} />
          
          <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-1.5">
            {state.devices.length === 0 ? (
              <div className="p-4 text-[11px] font-bold text-slate-500">Cihaz bulunamadı.</div>
            ) : state.devices.map(dev => {
              const typeColor = dev.type === 'valve' ? 'text-blue-600' : dev.type === 'laser_sensor' ? 'text-amber-600' : 'text-purple-600';
              return (
                <div key={dev.id} className={`px-3 py-2 flex items-center gap-3 border rounded-lg transition-colors ${dev.active ? 'bg-emerald-100/50 border-emerald-300' : 'bg-slate-200/50 border-slate-300'}`}>
                  <div className={`w-2 h-2 rounded-full ${dev.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'border border-slate-400'}`} />
                  <span className={`text-[10px] font-black tracking-wider w-4 ${typeColor}`}>{dev.type === 'valve' ? 'V' : dev.type === 'laser_sensor' ? 'L' : 'M'}</span>
                  <span className="text-[11px] font-bold text-slate-800 flex-1 truncate">{dev.name}</span>
                  <span className="text-[9px] font-bold text-slate-500 shrink-0 uppercase">{dev.target === 'nano' ? 'PLC Driver' : dev.target}/{dev.pin}</span>
                  <span className={`text-[10px] font-black w-8 text-right shrink-0 ${dev.active ? 'text-emerald-700' : 'text-slate-500'}`}>{dev.active ? 'ON' : 'OFF'}</span>
                </div>
              );
            })}
          </div>

          {/* ── CRITICAL PANEL (Solenoid Valfler & Sensörler) ── */}
          <div className="border-t border-slate-300 bg-slate-200 p-5 shrink-0 flex flex-col gap-4">
            <div className="text-[10px] font-black text-slate-600 tracking-widest uppercase mb-1 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <span>SİSTEM BİLEŞENLERİ</span>
            </div>
            
            {/* Lazerler ve Kilitler */}
            <div className="grid grid-cols-4 gap-2">
              {([
                { k:'KİLİT GİRİŞ',  d:entryLock, errOnActive:false },
                { k:'KİLİT ÇIKIŞ',  d:exitLock,  errOnActive:false },
                { k:'LAZER GİRİŞ',  d:inSensor,  errOnActive:true },
                { k:'LAZER ÇIKIŞ',  d:outSensor, errOnActive:true },
              ] as { k:string; d:Device|undefined; errOnActive:boolean }[]).map(({k,d,errOnActive}) => {
                const on = !!d?.active;
                const activeColor = errOnActive ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-emerald-400 bg-emerald-100 text-emerald-800';
                return (
                  <div key={k} className={`border rounded-md px-2 py-2 flex flex-col items-center justify-center transition-colors ${on ? activeColor : 'border-slate-300 bg-slate-100/80 text-slate-500'}`}>
                    <span className="text-[8px] font-black tracking-wider uppercase mb-1 text-center leading-tight">{k}</span>
                    <span className={`text-[11px] font-black ${on ? '' : 'text-slate-400'}`}>{on ? 'ON' : 'OFF'}</span>
                  </div>
                );
              })}
            </div>
            
            {/* Solenoid Valfler */}
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex justify-between items-center px-1">
                <span className="text-[9px] font-black text-slate-600 tracking-widest uppercase">SOLENOİD VALFLER ({valves.length})</span>
                <span className="text-[10px] font-bold text-slate-500">{valves.filter(v=>v.active).length} Aktif</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {valves.map((v, i) => (
                  <div key={v.id} className={`w-8 h-8 rounded border flex flex-col items-center justify-center transition-all ${v.active ? 'bg-blue-600 border-blue-700 text-white shadow-[0_4px_10px_rgba(37,99,235,0.4)] scale-105' : 'bg-slate-100 border-slate-300 text-slate-500'}`}>
                    <span className="text-[11px] font-black leading-none">{i+1}</span>
                  </div>
                ))}
                {valves.length === 0 && <span className="text-[10px] text-slate-500 italic font-bold">Valf tanımlanmamış.</span>}
              </div>
            </div>
            
          </div>
        </div>

        {/* ── RIGHT: LIVE LOG ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-200 relative">
          <SectionHeader text="CANLI OLAY KAYDI" />
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
            {logs.map(log => (
              <div key={log.id} className="flex gap-4 text-[11px] leading-relaxed group hover:bg-slate-300/50 px-2 py-1 rounded">
                <span className="text-slate-500 font-bold shrink-0">{log.ts}</span>
                <span className={`${LEVEL_COLOR[log.level]} font-black w-10 shrink-0`}>{log.level}</span>
                <span className={`${LOG_TEXT[log.level]} flex-1`}>{log.msg}</span>
              </div>
            ))}
            <div ref={bottomRef} className="h-4 shrink-0" />
          </div>
          
          {/* Overlay gradient for aesthetics */}
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-slate-200 to-transparent pointer-events-none" />
        </div>

      </div>
    </div>
  );
}

// ── Console helper components ──
function KVPair({ k, v, textColor }: { k:string; v:string; textColor:string }) {
  return (
    <div className="flex gap-2 items-center">
      <span className="text-[10px] text-slate-500 tracking-widest font-bold">{k}</span>
      <span className={`text-[13px] font-black ${textColor}`}>{v}</span>
    </div>
  );
}

function SectionHeader({ text }: { text:string }) {
  return (
    <div className="px-5 py-2.5 border-b border-slate-300 bg-slate-200 shrink-0">
      <span className="text-[10px] font-black text-slate-600 tracking-[0.2em] uppercase">{text}</span>
    </div>
  );
}

// ─── HARDWARE LIST ────────────────────────────────────

function HardwareList({ state }: { state: SystemState }) {
  return (
    <div className="absolute inset-0 p-8 overflow-y-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {state.devices.map(dev => (
          <div key={dev.id} className={`p-5 bg-white border transition-all duration-300 shadow-sm group ${RADIUS} ${dev.active ? 'border-blue-500 shadow-blue-50' : 'border-slate-100 hover:border-slate-300'}`}>
            <div className="flex justify-between items-center mb-4">
              <div className={`p-2 rounded-lg ${dev.active ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-50 text-slate-300'}`}>
                {dev.type === 'valve' ? <Droplet className="w-5 h-5" /> : <Microchip className="w-5 h-5" />}
              </div>
              <div className={`w-3 h-3 rounded-full ${dev.active ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_emerald]' : 'bg-slate-100'}`} />
            </div>
            <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 tracking-widest">{dev.role}</div>
            <div className="text-sm font-black text-slate-800 leading-none h-8 flex items-center uppercase">{dev.name}</div>
            <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between text-[10px] font-black">
              <span className="text-slate-300 italic">@{dev.target === 'nano' ? 'PLC DRIVER' : dev.target.toUpperCase()}</span>
              <span className="bg-slate-50 px-2 py-0.5 rounded text-blue-500">{dev.pin}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SETTINGS VIEW ──────────────────────────────────

function SettingsView({ state, apiCall }: { state: SystemState; apiCall: any }) {
  const [activeSub, setActiveSub] = useState<'inventory' | 'process'>('inventory');

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="flex px-8 border-b border-slate-200 shrink-0 bg-white shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] relative z-10 w-full pt-2">
        <MainTabButton active={activeSub === 'inventory'} onClick={() => setActiveSub('inventory')} label="DONANIM ENVANTERİ" />
        <MainTabButton active={activeSub === 'process'}   onClick={() => setActiveSub('process')}   label="ÜRETİM PARAMETRELERİ" />
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="mx-auto" style={{ maxWidth: '1000px' }}>
          {activeSub === 'inventory' ? <HardwareInventoryView state={state} apiCall={apiCall} /> : <ProcessSettingsView state={state} apiCall={apiCall} />}
        </div>
      </div>
    </div>
  );
}

function MainTabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string; }) {
  return (
    <button onClick={onClick} className={`px-6 h-12 flex items-center text-[11px] font-black tracking-widest transition-colors relative ${active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
      {label}
      <div className={`absolute bottom-0 left-6 right-6 h-[3px] bg-blue-600 rounded-t-full transition-all ${active ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`} />
    </button>
  );
}

// ─── PLC TERMINAL VIEW ──────────────────────────────────────

function PLCTerminalView({ state, apiCall }: { state: SystemState; apiCall: any }) {
  const [cmd, setCmd] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [ports, setPorts] = useState<{path:string}[]>([]);
  const [selPort, setSelPort] = useState('');
  const [selBaud, setSelBaud] = useState('115200');
  const [sbStatus, setSbStatus] = useState<{connected:boolean, port?:string, baud?:number}>({ connected: false });
  const [isConnecting, setIsConnecting] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Portları ve mevcut durumu yükle
    apiCall('/api/hardware/ports').then((data: any) => {
       const portsData = data || [];
       setPorts(portsData);
       
       // Otomatik seçme mantığı:
       // Eğer bağlı değilsek ve TEK bir ihtimalli PLC varsa onu seç
       if (!sbStatus.connected) {
         const likely = portsData.filter((p: any) => p.isLikelyPLC);
         if (likely.length === 1 && !selPort) {
           setSelPort(likely[0].path);
         } else if (portsData.length > 0 && !selPort) {
           setSelPort(portsData[0].path);
         }
       }
    });
    refreshStatus();
  }, [state.notifications.length]); // Bildirim geldiğinde (yeni cihaz takıldığında) listeyi yenile

  const refreshStatus = () => {
    fetch('/api/terminal/sandbox/status').then(r => r.json()).then(data => setSbStatus(data));
  };

  useEffect(() => {
    if (autoScroll) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [state.rawLogs, autoScroll]);

  const handleToggleConnect = async () => {
    setIsConnecting(true);
    if (sbStatus.connected) {
      await apiCall('/api/terminal/sandbox/disconnect', {});
    } else {
      await apiCall('/api/terminal/sandbox/connect', { port: selPort, baud: selBaud });
    }
    refreshStatus();
    setIsConnecting(false);
  };

  const handleSend = (overrideCmd?: string) => {
    const finalCmd = overrideCmd || cmd;
    if (!finalCmd.trim() || !sbStatus.connected) return;
    apiCall('/api/terminal', { target: 'nano', command: finalCmd });
    if (!overrideCmd) setCmd('');
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-slate-900 overflow-hidden font-mono shadow-inner">
      {/* Terminal Header */}
      <div className="h-10 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-500" />
          <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">PLC DRIVER CONSOLE</span>
          {sbStatus.connected && (
            <div className="ml-4 flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] text-emerald-500 font-black uppercase">LIVE: {sbStatus.port}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="sr-only" />
            <div className={`w-8 h-4 rounded-full transition-all relative ${autoScroll ? 'bg-emerald-600' : 'bg-slate-600'}`}>
              <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${autoScroll ? 'right-1' : 'left-1'}`} />
            </div>
            <span className="text-[9px] font-black text-slate-500 group-hover:text-slate-300 uppercase">Auto-Scroll</span>
          </label>
        </div>
      </div>

      {/* Terminal Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-0.5">
        {!state.rawLogs || state.rawLogs.length === 0 ? (
          <div className="text-slate-600 text-[11px] italic">Haberleşme bekleniyor...</div>
        ) : [...state.rawLogs].reverse().map(log => (
          <div key={log.id} className="group flex items-start gap-3 hover:bg-slate-800/50 px-2 py-0.5 rounded transition-colors">
            <span className="text-slate-500 text-[9px] shrink-0 pt-0.5">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
            <span className={`text-[10px] font-black shrink-0 w-8 ${log.direction === 'IN' ? 'text-emerald-500' : 'text-blue-500'}`}>
              {log.direction === 'IN' ? ' << ' : ' >> '}
            </span>
            <span className={`text-[10px] font-black shrink-0 w-16 ${log.source === 'NANO' ? 'text-amber-500' : log.source === 'RPI' ? 'text-indigo-400' : 'text-slate-400'}`}>
              {log.source}
            </span>
            <span className={`text-[11px] font-mono whitespace-pre-wrap break-all ${log.level === 'ERROR' ? 'text-rose-500 font-bold' : log.level === 'WARN' ? 'text-amber-400' : 'text-slate-200'}`}>
              {log.msg}
            </span>
          </div>
        ))}
      </div>

      {/* Quick Actions & Input & Connection */}
      <div className="p-4 bg-slate-800 border-t border-slate-700 shrink-0 flex flex-col gap-5">
        
        {/* Connection Row (Moved Down) */}
        <div className="flex items-center justify-between bg-slate-900/40 p-2 rounded border border-slate-700/50">
          <div className="flex items-center gap-3">
             <div className="flex items-center bg-slate-950 p-1 rounded-md border border-slate-800">
                <select 
                  className="bg-transparent text-[10px] font-black text-emerald-500 outline-none border-none px-3 uppercase cursor-pointer"
                  value={selPort}
                  onChange={e => setSelPort(e.target.value)}
                  disabled={sbStatus.connected}
                >
                  {ports.map((p: any) => (
                    <option key={p.path} value={p.path}>
                       {p.isLikelyPLC ? '⭐ ' : ''}{p.path} {p.manufacturer ? `(${p.manufacturer})` : ''}
                    </option>
                  ))}
                  {ports.length === 0 && <option value="">PORT TARANIYOR...</option>}
                </select>
                <div className="w-px h-4 bg-slate-800" />
                <select 
                  className="bg-transparent text-[10px] font-black text-amber-500 outline-none border-none px-3 uppercase cursor-pointer"
                  value={selBaud}
                  onChange={e => setSelBaud(e.target.value)}
                  disabled={sbStatus.connected}
                >
                  <option value="9600">9600 BAUD</option>
                  <option value="115200">115200 BAUD</option>
                </select>
             </div>
             <button 
                onClick={handleToggleConnect}
                disabled={isConnecting}
                className={`h-9 px-6 rounded font-black text-[10px] uppercase tracking-widest transition-all shadow-lg ${
                  sbStatus.connected 
                    ? 'bg-rose-500/20 text-rose-500 border border-rose-500/40 hover:bg-rose-500/30' 
                    : 'bg-emerald-600 text-slate-900 hover:bg-emerald-500'
                }`}
              >
                {isConnecting ? '...' : (sbStatus.connected ? 'BAĞLANTIYI KES' : 'PLC SÜRÜCÜYE BAĞLAN')}
              </button>
          </div>
          <button onClick={() => apiCall('/api/hardware/ports').then((p: any) => setPorts(p))} className="text-[9px] font-black text-slate-500 hover:text-indigo-400 transition-colors uppercase">Portları Tara</button>
        </div>

        {/* Quick Commands Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-90">
          {/* Sistem Grubu */}
          <div className="flex flex-col gap-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 border-b border-slate-700/50 pb-1">Sistem & Güvenlik</span>
            <div className="flex flex-wrap gap-2">
              <QuickCmdBtn label="STATUS" onClick={() => handleSend('STATUS')} color="bg-slate-700 text-slate-200" disabled={!sbStatus.connected} />
              <QuickCmdBtn label="ESTOP (ACİL)" onClick={() => handleSend('ESTOP')} color="bg-rose-900 text-rose-200" disabled={!sbStatus.connected} />
              <QuickCmdBtn label="RESET" onClick={() => handleSend('RESET')} color="bg-amber-900 text-amber-200" disabled={!sbStatus.connected} />
            </div>
          </div>

          {/* Hareket Grubu */}
          <div className="flex flex-col gap-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 border-b border-slate-700/50 pb-1">Mekanizma Kontrol</span>
            <div className="flex flex-wrap gap-2">
              <QuickCmdBtn label="GİRİŞ AÇ" onClick={() => handleSend('MOTOR:1:OPEN')} color="bg-indigo-900/50 text-indigo-200" disabled={!sbStatus.connected} />
              <QuickCmdBtn label="GİRİŞ KAPAT" onClick={() => handleSend('MOTOR:1:CLOSE')} color="bg-indigo-900/50 text-indigo-300" disabled={!sbStatus.connected} />
              <QuickCmdBtn label="ÇIKIŞ AÇ" onClick={() => handleSend('MOTOR:2:OPEN')} color="bg-indigo-900/50 text-indigo-200" disabled={!sbStatus.connected} />
              <QuickCmdBtn label="ÇIKIŞ KAPAT" onClick={() => handleSend('MOTOR:2:CLOSE')} color="bg-indigo-900/50 text-indigo-300" disabled={!sbStatus.connected} />
            </div>
          </div>

          {/* Valf Grubu */}
          <div className="flex flex-col gap-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 border-b border-slate-700/50 pb-1">Valf İşlemleri</span>
            <div className="flex flex-wrap gap-2">
              <QuickCmdBtn label="TÜMÜNÜ AÇ" onClick={() => handleSend('VALVE:ALL:ON')} color="bg-emerald-900/40 text-emerald-200" disabled={!sbStatus.connected} />
              <QuickCmdBtn label="TÜMÜNÜ KAPAT" onClick={() => handleSend('FILL_START:ALL=0')} color="bg-slate-700 text-slate-400" disabled={!sbStatus.connected} />
              <div className="w-px h-6 bg-slate-700 mx-1 hidden lg:block" />
              <QuickCmdBtn label="Hız Testi (1s)" onClick={() => handleSend('FILL_START:ALL=1000')} color="bg-blue-900/40 text-blue-200" disabled={!sbStatus.connected} />
            </div>
          </div>
        </div>

        {/* Manual Command Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-0 bottom-0 flex items-center text-emerald-600 font-black text-sm transition-all">&gt;_</div>
            <input 
              type="text" 
              value={cmd} 
              disabled={!sbStatus.connected}
              onChange={e => setCmd(e.target.value.toUpperCase())}
              placeholder={sbStatus.connected ? "MANUEL KOMUT GİRİNİZ (Örn: PINCFG:VALVE:D8)" : "İŞLEM YAPMAK İÇİN ÖNCE BAĞLANIN"}
              className={`w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-10 text-emerald-400 font-mono text-sm outline-none transition-all ${!sbStatus.connected ? 'opacity-50 cursor-not-allowed bg-slate-900' : 'focus:border-emerald-600 focus:ring-1 focus:ring-emerald-900/50 shadow-inner'}`}
            />
          </div>
          <button 
            type="submit" 
            disabled={!sbStatus.connected || !cmd.trim()}
            className={`h-11 px-10 bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest rounded-lg transition-all shadow-lg ${!sbStatus.connected || !cmd.trim() ? 'opacity-40 cursor-not-allowed' : 'hover:bg-emerald-500 active:scale-95 shadow-emerald-900/20'}`}
          >
            KOMUTU GÖNDER
          </button>
        </form>
      </div>
    </div>
  );
}

function QuickCmdBtn({ label, onClick, color, disabled }: { label:string; onClick:()=>void; color:string; disabled?:boolean }) {
  return (
    <button 
      disabled={disabled}
      onClick={onClick} 
      className={`px-4 h-8 rounded border border-transparent font-black text-[9px] tracking-tighter uppercase transition-all whitespace-nowrap ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105 active:scale-95'} ${color}`}
    >
      {label}
    </button>
  );
}

function ProcessSettingsView({ state, apiCall }: { state: SystemState; apiCall: any }) {
  const [activeTab, setActiveTab] = useState<'calib'|'cap'|'safe'|'cip'>('calib');
  const [customCip, setCustomCip] = useState(1);

  const tVol = state.config.targetVolumeML || 40;
  const tRate = state.config.baseFlowRateMs || 50;

  return (
    <div className="flex flex-col bg-white border border-slate-200 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] relative overflow-hidden flex-1 max-h-[700px] rounded-lg">
      <div className="flex overflow-x-auto bg-slate-50 shrink-0 border-b border-slate-200 hide-scrollbar rounded-t-lg">
        <ProcessTabBtn active={activeTab==='calib'} onClick={()=>setActiveTab('calib')} icon={<Droplet className="w-4 h-4"/>} label="KALİBRASYON" />
        <ProcessTabBtn active={activeTab==='cap'} onClick={()=>setActiveTab('cap')} icon={<Activity className="w-4 h-4"/>} label="KAPASİTE" />
        <ProcessTabBtn active={activeTab==='safe'} onClick={()=>setActiveTab('safe')} icon={<Shield className="w-4 h-4"/>} label="GÜVENLİK" />
        <ProcessTabBtn active={activeTab==='cip'} onClick={()=>setActiveTab('cip')} icon={<RefreshCw className="w-4 h-4"/>} label="YIKAMA (CIP)" />
      </div>

      <div className="p-6 md:p-8 flex-1 overflow-y-auto bg-slate-50/10">
        {activeTab === 'calib' && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputComponent label="Hedef Şişe Dolum Hacmi" value={tVol} unit="ML" onChange={v => apiCall('/api/config', { targetVolumeML: v })} disabled={state.systemRunning} />
                <InputComponent label="Birim Valf Debi Katsayısı" value={tRate} unit="MS / 1 ML" onChange={v => apiCall('/api/config', { baseFlowRateMs: v })} disabled={state.systemRunning} />
             </div>
             <div className={`p-5 border border-blue-200 bg-blue-50 text-blue-800 ${RADIUS} flex justify-between items-center shadow-inner mt-2`}>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Mevcut Kalibrasyon Sonucu</span>
                  <span className="text-sm font-bold mt-0.5 max-w-sm">Her valf ortalama <span className="text-blue-700 font-black">{tVol * tRate} MS</span> açık kalarak <span className="text-blue-700 font-black">{tVol} ML</span> sıvı dolduracak.</span>
                </div>
                <Droplet className="w-10 h-10 text-blue-400 opacity-50 shrink-0 ml-4 animate-pulse flex-none" />
             </div>
          </div>
        )}

        {activeTab === 'cap' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <InputComponent label="Vardiya Kotası" value={state.config.dailyQuota} unit="ŞİŞE" onChange={v => apiCall('/api/config', { dailyQuota: v })} disabled={state.systemRunning} />
             <InputComponent label="Hattaki Hedef Şişe (Aynı Anda)" value={state.process.targetBottles} unit="ADET" onChange={v => apiCall('/api/config', { targetBottles: v })} disabled={state.systemRunning} />
             <InputComponent label="Konveyör Bant Hızı" value={state.config.conveyorSpeed || 80} unit="% PWM" onChange={v => apiCall('/api/config', { conveyorSpeed: v })} disabled={state.systemRunning} />
          </div>
        )}

        {activeTab === 'safe' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <InputComponent label="Sensör Zaman Aşımı" value={state.config.sensorTimeout} unit="MS" onChange={v => apiCall('/api/config', { sensorTimeout: v })} disabled={state.systemRunning} />
             <InputComponent label="Valf Damlatma Bekleme (Gecikme)" value={state.config.dropDelayMs || 500} unit="MS" onChange={v => apiCall('/api/config', { dropDelayMs: v })} disabled={state.systemRunning} />
          </div>
        )}

        {activeTab === 'cip' && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10 w-full mb-2">
              <WashActionBtn label="SABAH AÇILIŞ" sub="60 saniye Hızlı" onClick={() => apiCall('/api/wash', { duration: 60000 })} disabled={state.systemRunning || state.process.state === 'WASHING'} primary />
              <WashActionBtn label="AKŞAM KAPANIŞ" sub="300 saniye Detaylı" onClick={() => apiCall('/api/wash', { duration: 300000 })} disabled={state.systemRunning || state.process.state === 'WASHING'} />
            </div>
            
            <div className={`p-6 border border-slate-200 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ${RADIUS} shadow-sm border-t-4 border-t-blue-500`}>
               <div className="flex flex-col flex-1 w-full">
                 <span className="text-[11px] font-black uppercase tracking-widest text-slate-800 mb-3 block border-b border-slate-100 pb-2">Özel Süreli Manuel Yıkama Uzunluğu (Dakika)</span>
                 <div className="flex gap-4 w-full mt-2">
                    <div className="relative flex-1">
                      <input type="number" min="1" max="60" value={customCip} onChange={e=>setCustomCip(parseInt(e.target.value)||1)} disabled={state.systemRunning || state.process.state === 'WASHING'} className="w-full h-11 px-4 border text-[13px] border-slate-300 font-black text-slate-700 outline-none focus:border-blue-500 disabled:opacity-50 rounded" />
                      <span className="absolute right-4 top-0 bottom-0 flex items-center text-[10px] font-black text-slate-400">DAKİKA</span>
                    </div>
                    <button onClick={() => apiCall('/api/wash', { duration: customCip * 60000 })} disabled={state.systemRunning || state.process.state === 'WASHING'} className={`h-11 px-8 bg-blue-600 text-white text-[11px] font-black uppercase flex items-center gap-2 hover:bg-blue-700 transition shadow-md rounded disabled:opacity-50 shrink-0`}>
                       <Play className="w-4 h-4 fill-white"/> BAŞLAT
                    </button>
                 </div>
               </div>
            </div>

            {state.process.state === 'WASHING' && (
              <div className="absolute inset-0 bg-blue-600/95 backdrop-blur-md flex flex-col items-center justify-center text-white gap-4 z-20 pointer-events-auto rounded-lg shadow-2xl">
                <RefreshCw className="w-10 h-10 animate-spin" />
                <span className="text-xl font-black tracking-widest uppercase text-white shadow-sm">CIP İŞLEMİ SÜRÜYOR</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProcessTabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex-1 min-w-[200px] h-14 flex items-center justify-center gap-3 border-b-[3px] font-black text-[11px] tracking-widest uppercase transition-all ${active ? 'border-blue-600 text-blue-600 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.02)_inset]' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'}`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function InputComponent({ label, value, unit, onChange, disabled }: { label: string; value: number; unit: string; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className={`flex flex-col bg-white border border-slate-200 p-4 shadow-sm transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-50 ${RADIUS} ${disabled ? 'opacity-60 bg-slate-50/50' : ''}`}>
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{label}</label>
      <div className="relative flex items-center">
        <input type="number" disabled={disabled} value={value} onChange={e => onChange(parseInt(e.target.value)||0)}
          className="w-full bg-transparent font-mono font-black text-2xl text-slate-800 outline-none pb-1" />
        <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded uppercase tracking-wider shrink-0">{unit}</span>
      </div>
    </div>
  );
}

function WashActionBtn({ label, sub, onClick, disabled, primary }: { label: string; sub: string; onClick: () => void; disabled: boolean; primary?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`flex-1 h-20 px-5 flex items-center justify-between transition-all border shadow-sm ${RADIUS} hover:shadow-md active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none group ${primary ? 'bg-blue-50 border-blue-200 hover:border-blue-300 hover:bg-blue-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'}`}>
      <div className="flex flex-col items-start gap-0.5">
        <span className={`text-[13px] font-black uppercase tracking-wide ${primary ? 'text-blue-700' : 'text-slate-700'}`}>{label}</span>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${primary ? 'text-blue-500/80' : 'text-slate-400'}`}>{sub}</span>
      </div>
      <RefreshCw className={`w-5 h-5 transition-transform group-hover:rotate-180 ${primary ? 'text-blue-500' : 'text-slate-400'}`} />
    </button>
  );
}

// ─── HARDWARE INVENTORY VIEW ───

function HardwareInventoryView({ state, apiCall }: { state: SystemState; apiCall: any }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState<Partial<Device>>({ 
    type: 'valve', target: 'nano', role: 'none', pin: '', name: '',
    manufacturer: '', model: '', serialNumber: '', description: '',
    installDate: new Date().toISOString().split('T')[0],
    lastMaintenance: '', specs: '', inverted: false, category: 'other'
  });
  const [formTab, setFormTab] = useState<'basic' | 'tech' | 'physical'>('basic');

  return (
    <div className="flex flex-col gap-6">
      <div className={`flex justify-between items-center bg-white p-5 border border-slate-200 shadow-sm ${RADIUS}`}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h4 className="text-sm font-black text-slate-800 tracking-wider">CİHAZ DEFTERİ</h4>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">{state.devices.length} DONANIM BAĞLI</span>
          </div>
        </div>
        <button 
          onClick={() => { 
            setForm({ 
              type: 'valve', target: 'nano', role: 'none', pin: '', name: '',
              manufacturer: '', model: '', serialNumber: '', description: '',
              installDate: new Date().toISOString().split('T')[0],
              lastMaintenance: '', specs: '', inverted: false, category: 'other'
            }); 
            setEditId(null); 
            setIsAdding(true); 
            setFormTab('basic');
          }} 
          disabled={state.systemRunning} 
          className={`h-10 px-5 bg-blue-600 text-white font-bold text-[11px] uppercase tracking-wider shadow-md hover:bg-blue-700 active:scale-95 transition-all ${RADIUS} disabled:opacity-40 flex items-center gap-2`}
        >
          <PlusCircle className="w-4 h-4" /> YENİ BİRİM
        </button>
      </div>

      {isAdding && (
        <div className={`bg-white border-2 border-blue-400 shadow-2xl relative ${RADIUS} animate-in fade-in slide-in-from-top-2 flex flex-col overflow-hidden`}>
          {/* Form Tabs */}
          <div className="flex bg-slate-50 border-b border-slate-100">
            <button onClick={() => setFormTab('basic')} className={`flex-1 h-12 text-[10px] font-black tracking-widest transition-all border-b-2 ${formTab === 'basic' ? 'border-blue-500 text-blue-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>TEMEL BİLGİLER</button>
            <button onClick={() => setFormTab('tech')}  className={`flex-1 h-12 text-[10px] font-black tracking-widest transition-all border-b-2 ${formTab === 'tech' ? 'border-blue-500 text-blue-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>ENDÜSTRİYEL DETAYLAR</button>
            <button onClick={() => setFormTab('physical')} className={`flex-1 h-12 text-[10px] font-black tracking-widest transition-all border-b-2 ${formTab === 'physical' ? 'border-blue-500 text-blue-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>FİZİKSEL BAĞLANTI</button>
          </div>

          <div className="p-6 flex flex-col gap-6">
            {formTab === 'basic' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                <FormGroup label="Birim Tipi">
                  <select className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 uppercase outline-none focus:border-blue-500 ${RADIUS}`} value={form.type} onChange={e=>setForm({...form, type: e.target.value as any})}>
                    <option value="valve">SOLENOID VALF</option>
                    <option value="motor">PNÖMATİK AKTÜATÖR</option>
                    <option value="laser_sensor">LAZER SENSÖR</option>
                    <option value="generic">GENEL BİRİM</option>
                  </select>
                </FormGroup>
                <FormGroup label="Kategori">
                  <select className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 uppercase outline-none focus:border-blue-500 ${RADIUS}`} value={form.category} onChange={e=>setForm({...form, category: e.target.value as any})}>
                    <option value="valve">VALFLER</option>
                    <option value="sensor">SENSÖRLER</option>
                    <option value="actuator">AKTÜATÖRLER</option>
                    <option value="other">DİĞER</option>
                  </select>
                </FormGroup>
                <FormGroup label="Etiket Adı (Tag)">
                  <input type="text" className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-blue-500 ${RADIUS}`} value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="Ör: Ana Giriş Valfi" />
                </FormGroup>
                <div className="md:col-span-2 lg:col-span-3">
                  <FormGroup label="Cihaz Açıklaması">
                    <textarea className={`w-full p-3 border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700 outline-none focus:border-blue-500 min-h-[80px] ${RADIUS}`} value={form.description} onChange={e=>setForm({...form, description: e.target.value})} placeholder="Donanımın görevi, lokasyonu veya özel notlar..." />
                  </FormGroup>
                </div>
              </div>
            )}

            {formTab === 'tech' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                <FormGroup label="Üretici / Marka">
                  <input type="text" className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-blue-500 ${RADIUS}`} value={form.manufacturer} onChange={e=>setForm({...form, manufacturer: e.target.value})} placeholder="Ör: Festo, SMC, Omron" />
                </FormGroup>
                <FormGroup label="Model Kodu">
                  <input type="text" className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-blue-500 ${RADIUS}`} value={form.model} onChange={e=>setForm({...form, model: e.target.value})} placeholder="Ör: VUVG-L10-B52" />
                </FormGroup>
                <FormGroup label="Seri Numarası">
                  <input type="text" className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-blue-500 ${RADIUS}`} value={form.serialNumber} onChange={e=>setForm({...form, serialNumber: e.target.value})} placeholder="S/N: 12345678" />
                </FormGroup>
                <FormGroup label="Montaj Tarihi">
                  <input type="date" className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-blue-500 ${RADIUS}`} value={form.installDate} onChange={e=>setForm({...form, installDate: e.target.value})} />
                </FormGroup>
                <FormGroup label="Son Bakım Tarihi">
                  <input type="date" className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-blue-500 ${RADIUS}`} value={form.lastMaintenance} onChange={e=>setForm({...form, lastMaintenance: e.target.value})} />
                </FormGroup>
                <FormGroup label="Donanım Özellikleri (Specs)">
                  <input type="text" className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-blue-500 ${RADIUS}`} value={form.specs} onChange={e=>setForm({...form, specs: e.target.value})} placeholder="Ör: 24VDC, IP67, 5/2 Way" />
                </FormGroup>
              </div>
            )}

            {formTab === 'physical' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                <FormGroup label="Bağlı Olduğu Ünite">
                  <select className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 uppercase outline-none focus:border-blue-500 ${RADIUS}`} value={form.target} onChange={e=>setForm({...form, target: e.target.value as any})}>
                    <option value="nano">PLC DRIVER (USB SERIAL)</option>
                    <option value="raspi">MASTER (RPI GPIO)</option>
                  </select>
                </FormGroup>
                <FormGroup label="Fiziksel Pin / Adres">
                  <input type="text" className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 uppercase outline-none focus:border-blue-500 ${RADIUS}`} value={form.pin} onChange={e=>setForm({...form, pin: e.target.value})} placeholder="D8 veya GPIO17" />
                </FormGroup>
                <FormGroup label="Mantıksal Rol (Sistem Ataması)">
                  <select className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 uppercase outline-none focus:border-blue-500 ${RADIUS}`} value={form.role} onChange={e=>setForm({...form, role: e.target.value as any})}>
                    <option value="none">Sistem Dışı / Manuel</option>
                    <option value="entry_laser">GİRİŞ SENSÖRÜ</option>
                    <option value="exit_laser">ÇIKIŞ SENSÖRÜ</option>
                    <option value="entry_lock">GİRİŞ KİLİDİ</option>
                    <option value="exit_lock">ÇIKIŞ KİLİDİ</option>
                    {Array.from({length:10}).map((_,i) => <option key={i} value={`valve_${i+1}`}>NOZUL {i+1} VALFİ</option>)}
                  </select>
                </FormGroup>
                <div className="flex items-center gap-3 pt-4 px-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={form.inverted} onChange={e => setForm({...form, inverted: e.target.checked})} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Ters Mantık (Active Low)</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center p-6 bg-slate-50 border-t border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase">* Tüm endüstriyel veriler SQLite veritabanında saklanır.</span>
            <div className="flex gap-3">
              <button onClick={()=>{ setIsAdding(false); setEditId(null); }} className={`px-6 h-11 text-[11px] font-black text-slate-500 hover:bg-slate-200 transition-colors ${RADIUS}`}>İPTAL</button>
              <button onClick={() => { apiCall('/api/devices', { device: { ...form, id: editId || Math.random().toString(36).substr(2, 9) } }); setIsAdding(false); setEditId(null); }} className={`px-10 h-11 bg-blue-600 text-white text-[11px] font-black uppercase shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 ${RADIUS}`}>{editId ? 'GÜNCELLE' : 'ENVANTERE EKLE'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {state.devices.map(dev => (
          <div key={dev.id} className={`flex items-center justify-between p-4 bg-white border border-slate-200 hover:border-blue-200 transition-colors shadow-sm focus-within:ring-1 focus-within:ring-blue-100 ${RADIUS}`}>
            <div className="flex items-center gap-4 min-w-0">
              <div className={`w-10 h-10 shrink-0 flex items-center justify-center border transition-all ${RADIUS} ${dev.active ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                {dev.type === 'valve' ? <Droplet className="w-4 h-4" /> : <Microchip className="w-4 h-4" />}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[13px] font-black text-slate-800 uppercase truncate">{dev.name}</span>
                  {dev.manufacturer && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black rounded-full uppercase">{dev.manufacturer}</span>}
                  {dev.model && <span className="px-2 py-0.5 bg-blue-50 text-blue-500 text-[9px] font-black rounded-full uppercase">{dev.model}</span>}
                  {dev.active && <span className="w-2 h-2 bg-green-500 rounded-full shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-bold uppercase tracking-wider">
                  <span className="text-blue-500 bg-blue-50/50 px-1.5 rounded">{dev.role.replace('_', ' ')}</span>
                  <span className="text-slate-400">{dev.target === 'nano' ? 'PLC DRIVER' : 'MASTER'} &rarr; {dev.pin}</span>
                  {dev.installDate && <span className="text-slate-300">İNS: {dev.installDate}</span>}
                  {dev.inverted && <span className="text-rose-400 font-black italic">[INVERTED]</span>}
                </div>
                {dev.description && <p className="text-[9px] text-slate-400 mt-1.5 italic line-clamp-1">"{dev.description}"</p>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0 ml-4">
              <button disabled={state.systemRunning} onClick={() => { setForm(dev); setEditId(dev.id); setIsAdding(true); }} className={`h-9 px-4 text-[10px] font-black border border-blue-200 bg-blue-50 text-blue-600 hover:border-blue-400 hover:bg-blue-100 transition-all ${RADIUS}`}>DÜZENLE</button>
              <button onClick={() => apiCall(`/api/devices/${dev.id}/trigger`, {})} className={`h-9 px-4 text-[10px] font-black border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-white transition-all ${RADIUS}`}>TEST</button>
              <button disabled={state.systemRunning} onClick={() => apiCall(`/api/devices/${dev.id}`, {}, 'DELETE')} className={`h-9 px-3 border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all ${RADIUS} disabled:opacity-40 disabled:pointer-events-none group`} title="Cihazı Sil">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">{label}</label>
      {children}
    </div>
  );
}

// ─── EMERGENCY ALARM SCREEN ───

function EmergencyShutter({ onReset }: { onReset: () => void }) {
  return (
    <div className="absolute inset-0 z-[100] bg-zinc-950/95 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(225,29,72,0.15),transparent_70%)]" />
      <div className="relative flex flex-col items-center max-w-2xl w-full translate-y-[-2vh]">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-rose-500 blur-3xl opacity-40 animate-pulse" />
          <div className="w-28 h-28 bg-gradient-to-tr from-rose-600 to-rose-400 rounded-full flex items-center justify-center shadow-2xl relative z-10 border-4 border-rose-950">
             <Lock className="w-12 h-12 text-white" />
          </div>
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-white leading-none uppercase tracking-tight drop-shadow-lg mb-3">SİSTEM KİLİTLİ</h1>
        <p className="text-sm md:text-base text-rose-300 font-bold uppercase tracking-[0.4em] mb-12">Acil Stop Aktif Edildi</p>
        <button onClick={onReset} className={`group relative w-full overflow-hidden bg-rose-600 p-1 flex items-center shadow-2xl transition hover:bg-rose-500 active:scale-[0.98] ${RADIUS}`}>
          <div className={`bg-rose-950/50 w-full h-16 flex items-center justify-center gap-3 ${RADIUS}`}>
            <Unlock className="w-5 h-5 text-rose-200 group-hover:text-white transition-colors" />
            <span className="text-[13px] font-black text-rose-100 group-hover:text-white uppercase tracking-widest transition-colors">KİLİDİ AÇ VE GÜVENLİ SIFIRLA</span>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── NOTIFICATION TOAST ───────────────────────────

function NotificationToast({ notification }: { notification: SystemNotification; key?: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const bg = notification.type === 'success' ? 'bg-emerald-600' : 'bg-blue-600';

  return (
    <div className={`w-80 p-4 ${bg} text-white shadow-2xl ${RADIUS} pointer-events-auto flex gap-4 animate-in slide-in-from-right fade-in duration-300 relative border border-white/20`}>
      <div className="shrink-0 flex items-center justify-center">
        <Bell className="w-5 h-5 text-white/80" />
      </div>
      <div className="flex flex-col gap-1 pr-4">
        <span className="text-[10px] font-black tracking-widest uppercase opacity-80">{notification.title}</span>
        <p className="text-[11px] font-bold leading-tight">{notification.message}</p>
      </div>
      <button onClick={() => setVisible(false)} className="absolute top-2 right-2 text-white/50 hover:text-white transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

