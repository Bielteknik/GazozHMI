import React, { useEffect, useState, useRef } from 'react';
import {
  Activity, Settings, AlertTriangle, Droplet, Cpu, ScanLine,
  Play, Square, Lock, Unlock, Timer, Terminal, History, Bell,
  PlusCircle, Trash2, Cpu as Microchip, LayoutDashboard, Map as MapIcon, RefreshCw, Layers
} from 'lucide-react';
import { SystemState, Device } from './types';

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
          
          {activeTab === 'dashboard' && <DashboardView state={state} />}
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

function DashboardView({ state }: { state: SystemState }) {
  const [subTab, setSubTab] = useState<'console' | 'map'>('console');

  return (
    <div className="h-full flex flex-col">
      <div className="flex bg-white border-b border-slate-100">
        <SubTab active={subTab === 'console'} onClick={() => setSubTab('console')} label="CANLI KONSOL" />
        <SubTab active={subTab === 'map'}     onClick={() => setSubTab('map')}     label="DONANIM ENVANTERİ" />
      </div>
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {subTab === 'console' ? <ConsoleView state={state} /> : <HardwareList state={state} />}
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

function SubTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string; }) {
  return (
    <button onClick={onClick} className={`h-11 px-4 font-black text-[10px] tracking-widest transition-all relative ${active ? 'text-slate-900' : 'text-slate-300 hover:text-slate-500'}`}>
      {label}
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
          {state.systemRunning && <span className="text-[10px] font-black tracking-widest text-emerald-600 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>ÇALIŞIYOR</span>}
          {state.emergencyStop && <span className="text-[10px] font-black tracking-widest text-rose-600 flex items-center gap-1.5 animate-pulse"><AlertTriangle className="w-3.5 h-3.5"/>ACİL STOP</span>}
          {!state.systemRunning && !state.emergencyStop && <span className="text-[10px] font-black tracking-widest text-slate-500 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full border-2 border-slate-500"/>DURAKLADI</span>}
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

function ProcessSettingsView({ state, apiCall }: { state: SystemState; apiCall: any }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputComponent label="Hattaki Hedef Şişe" value={state.process.targetBottles} unit="ADET" onChange={v => apiCall('/api/config', { targetBottles: v })} disabled={state.systemRunning} />
        <InputComponent label="Kanal Dolum Süresi" value={state.config.fillWaitTime} unit="MS" onChange={v => apiCall('/api/config', { fillWaitTime: v })} disabled={state.systemRunning} />
        <InputComponent label="Sensör Zaman Aşımı" value={state.config.sensorTimeout} unit="MS" onChange={v => apiCall('/api/config', { sensorTimeout: v })} disabled={state.systemRunning} />
        <InputComponent label="Vardiya Kotası" value={state.config.dailyQuota} unit="ŞİŞE" onChange={v => apiCall('/api/config', { dailyQuota: v })} disabled={state.systemRunning} />
      </div>

      <div className={`p-6 bg-white border border-slate-200 shadow-sm ${RADIUS} relative overflow-hidden mt-2`}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1.5 h-5 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full" />
          <h4 className="text-[11px] font-black text-slate-800 tracking-widest uppercase">OTOMATİK YIKAMA (CIP) RUTİNLERİ</h4>
        </div>
        <div className="flex gap-4 relative z-10 w-full mb-1">
          <WashActionBtn label="SABAH AÇILIŞ" sub="60sn Hızlı" onClick={() => apiCall('/api/wash', { duration: 60000 })} disabled={state.systemRunning || state.process.state === 'WASHING'} primary />
          <WashActionBtn label="AKŞAM KAPANIŞ" sub="300sn Detaylı" onClick={() => apiCall('/api/wash', { duration: 300000 })} disabled={state.systemRunning || state.process.state === 'WASHING'} />
        </div>
        {state.process.state === 'WASHING' && (
          <div className="absolute inset-0 bg-blue-600/95 backdrop-blur-md flex flex-col items-center justify-center text-white gap-3 z-20 pointer-events-auto">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <span className="text-lg font-black tracking-widest uppercase">CIP İŞLEMİ SÜRÜYOR</span>
          </div>
        )}
      </div>
    </div>
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
  const [form, setForm] = useState<Partial<Device>>({ type: 'valve', target: 'nano', role: 'none', pin: '', name: '' });

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
        <button onClick={() => setIsAdding(true)} disabled={state.systemRunning} className={`h-10 px-5 bg-blue-600 text-white font-bold text-[11px] uppercase tracking-wider shadow-md hover:bg-blue-700 active:scale-95 transition-all ${RADIUS} disabled:opacity-40 flex items-center gap-2`}>
          <PlusCircle className="w-4 h-4" /> YENİ BİRİM
        </button>
      </div>

      {isAdding && (
        <div className={`bg-white border-2 border-blue-400 p-6 shadow-xl relative ${RADIUS} animate-in fade-in slide-in-from-top-2 flex flex-col gap-5`}>
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-1">
            <Settings className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-black text-slate-800 tracking-wider uppercase">Donanım Kayıt Formu</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormGroup label="Birim Tipi">
              <select className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 uppercase outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${RADIUS}`} value={form.type} onChange={e=>setForm({...form, type: e.target.value as any})}>
                <option value="valve">SOLENOID VALF</option>
                <option value="motor">PNÖMATİK AKTÜATÖR</option>
                <option value="laser_sensor">LAZER SENSÖR</option>
              </select>
            </FormGroup>
            <FormGroup label="Sürücü / Hedef">
              <select className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 uppercase outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${RADIUS}`} value={form.target} onChange={e=>setForm({...form, target: e.target.value as any})}>
                <option value="nano">PLC DRIVER (USB SERIAL)</option>
                <option value="raspi">MASTER (NATIVE PINS)</option>
              </select>
            </FormGroup>
            <FormGroup label="Bağlantı Pin'i">
              <input type="text" className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 uppercase outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${RADIUS}`} value={form.pin} onChange={e=>setForm({...form, pin: e.target.value})} placeholder="Örnek: D8" />
            </FormGroup>
            <FormGroup label="Etiket Adı">
              <input type="text" className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${RADIUS}`} value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="Ör: Ana Valf" />
            </FormGroup>
            <FormGroup label="Mantıksal Rol">
              <select className={`w-full h-11 border border-slate-200 bg-slate-50 px-3 text-[11px] font-bold text-slate-700 uppercase outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${RADIUS}`} value={form.role} onChange={e=>setForm({...form, role: e.target.value as any})}>
                <option value="none">SADECE MANUEL TEST</option>
                <option value="entry_laser">GİRİŞ LAZERİ</option>
                <option value="exit_laser">ÇIKIŞ LAZERİ</option>
                <option value="entry_lock">GİRİŞ BARİYERİ</option>
                <option value="exit_lock">ÇIKIŞ BARİYERİ</option>
                {Array.from({length:10}).map((_,i) => <option key={i} value={`valve_${i+1}`}>NOZUL {i+1} VALFİ</option>)}
              </select>
            </FormGroup>
          </div>
          <div className="flex justify-end gap-3 pt-2 mt-2 border-t border-slate-100">
            <button onClick={()=>setIsAdding(false)} className={`px-6 h-10 text-[11px] font-black text-slate-500 hover:bg-slate-100 transition-colors ${RADIUS}`}>İPTAL ET</button>
            <button onClick={() => { apiCall('/api/devices', { device: { ...form, id: Math.random().toString(36).substr(2, 9) } }); setIsAdding(false); }} className={`px-8 h-10 bg-blue-600 text-white text-[11px] font-black uppercase shadow-md hover:bg-blue-700 transition-colors ${RADIUS}`}>KAYDET</button>
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
              <div className="flex flex-col min-w-0 truncate">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13px] font-black text-slate-800 uppercase truncate">{dev.name}</span>
                  {dev.active && <span className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0" />}
                </div>
                <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider h-3">
                  <span className="text-blue-500">{dev.role.replace('_', ' ')}</span>
                  <span className="w-1 h-1 bg-slate-200 rounded-full" />
                  <span className="text-slate-400">{dev.target === 'nano' ? 'PLC DRIVER' : dev.target} &rarr; {dev.pin}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0 ml-4">
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

