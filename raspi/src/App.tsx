import React, { useEffect, useState } from 'react';
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
  const [subTab, setSubTab] = useState<'visual' | 'map'>('visual');
  const inSensor = state.devices.find(d => d.role === 'entry_laser');
  const outSensor = state.devices.find(d => d.role === 'exit_laser');

  return (
    <div className="h-full flex flex-col">
      {/* ─── TOP ANALYTICS ─── */}
      <div className="grid grid-cols-4 gap-3 p-4 bg-white border-b border-slate-100">
        <AnalyticCard label="Hattın Mevcut Fazı" value={pStateMap[state.process.state]} icon={<Layers className="text-blue-500" />} />
        <AnalyticCard label="Bölgedeki Ürün" value={`${state.process.bottlesInArea} / ${state.process.targetBottles}`} icon={<Droplet className="text-cyan-500" />} />
        <AnalyticCard label="Toplam Giriş" value={inSensor?.count?.toString() || "0"} icon={<Activity className="text-emerald-500" />} />
        <AnalyticCard label="Toplam Çıkış" value={outSensor?.count?.toString() || "0"} icon={<RefreshCw className="text-orange-500" />} />
      </div>

      {/* ─── MAIN DISPLAY ─── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex bg-white border-b border-slate-50">
          <SubTab active={subTab === 'visual'} onClick={() => setSubTab('visual')} label="CANLI TEKNİK HAT DURUMU" />
          <SubTab active={subTab === 'map'}    onClick={() => setSubTab('map')}    label="DONANIM ENVANTERİ" />
        </div>
        
        <div className="flex-1 relative bg-slate-50/50">
          {subTab === 'visual' ? <PremiumMimicDiagram state={state} /> : <HardwareList state={state} />}
        </div>
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

// ─── PREMIUM MIMIC DIAGRAM (The Masterpiece) ───

function PremiumMimicDiagram({ state }: { state: SystemState }) {
  const valves = state.devices.filter(d => d.type === 'valve').sort((a,b) => a.role.localeCompare(b.role));
  const entryLock = state.devices.find(d => d.role === 'entry_lock');
  const exitLock = state.devices.find(d => d.role === 'exit_lock');
  const inSensor = state.devices.find(d => d.role === 'entry_laser');
  const outSensor = state.devices.find(d => d.role === 'exit_laser');

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 overflow-hidden">
      
      <div className="w-full flex flex-row h-[650px]">
        
        {/* LEFT PANEL: TANK AREA - 25% (Aligned to the far left with 30px gap) */}
        <div className="w-1/4 h-full relative flex items-center justify-start pl-[30px]">
           <div className="flex flex-col items-center scale-90 xxl:scale-100">
              <div className="w-24 h-8 bg-slate-300 rounded-full border border-slate-400 mb-[-1px] z-10 shadow-sm" />
              <div className="w-72 h-[450px] bg-gradient-to-r from-slate-400 via-slate-100 to-slate-400 border-x-4 border-slate-300 rounded-t-[50px] relative shadow-2xl overflow-hidden">
                 <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.8),transparent_50%)]" />
                 <div className="absolute bottom-12 right-8 w-6 h-[300px] bg-slate-800/20 rounded-full p-[4px] border border-white/10">
                    <div className="w-full h-[65%] bg-gradient-to-t from-blue-500 to-blue-400 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-pulse" />
                 </div>
              </div>
              <div className="flex gap-48 mt-[-1px]">
                 <div className="w-8 h-24 bg-gradient-to-b from-slate-400 to-slate-600 rounded-b-2xl shadow-md" />
                 <div className="w-8 h-24 bg-gradient-to-b from-slate-400 to-slate-600 rounded-b-2xl shadow-md" />
              </div>
              <div className="mt-8 px-10 py-4 bg-slate-900 text-white rounded-full text-xs font-black tracking-[0.3em] shadow-2xl border-2 border-slate-700">ŞERBET TANKI</div>
           </div>
        </div>

        {/* RIGHT PANEL: PRODUCTION MACHINE - 75% */}
        <div className="w-3/4 h-full relative flex items-center justify-center p-8">
          
          {/* Main Production Line Core (Vertical Stack) */}
          <div className="flex flex-col items-center gap-6 w-full max-w-5xl relative translate-y-[-20px]">
            
            {/* 1. NOZZLE UNIT (Aligned perfectly above bottles) */}
            <div className="w-full flex justify-around items-end gap-1 px-10 relative z-10 h-24">
               {Array.from({length: state.process.targetBottles}).map((_, i) => (
                 <div key={i} className="flex flex-col items-center">
                    <div className="text-[7px] font-black text-slate-300 mb-1">UNIT-{i+1}</div>
                    <div className={`w-10 h-16 border-2 transition-all duration-300 rounded-md shadow-md relative ${valves[i]?.active ? 'bg-blue-500 border-blue-600 shadow-blue-100 scale-105' : 'bg-white border-slate-100 opacity-60'}`}>
                       {valves[i]?.active && (
                         <div className="absolute top-full left-1/2 -translate-x-1/2 w-4 h-[100px] bg-gradient-to-b from-blue-400/60 to-transparent animate-pulse rounded-full z-10" />
                       )}
                    </div>
                 </div>
               ))}
            </div>

            {/* 2. BOTTLES LAYER */}
            <div className="w-full flex justify-around items-end gap-1 px-10 h-40 relative z-20">
               {Array.from({length: state.process.targetBottles}).map((_, i) => (
                 <div key={i} className={`w-18 h-36 border-2 transition-all duration-500 p-1 relative shadow-lg rounded-md ${i < state.process.bottlesInArea 
                   ? 'bg-white border-slate-300 scale-100 opacity-100' 
                   : 'bg-white/40 border-slate-200 scale-95 opacity-50'}`}>
                    {/* Fluid Fill Visual */}
                    {i < state.process.bottlesInArea && (
                      <div className={`absolute bottom-1 left-1 right-1 bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-sm transition-all duration-1000 ${RADIUS}`} 
                           style={{ height: state.process.state === 'FILLING' ? '85%' : '15%' }} />
                    )}
                    <div className="absolute inset-0 border border-white/20 pointer-events-none rounded-md" />
                 </div>
               ))}
            </div>

            {/* 3. THE CONVEYOR & PILLARS UNIT (The Anchor) */}
            <div className="w-full relative px-2">
               {/* The Belt */}
               <div className="w-full h-12 bg-gradient-to-r from-slate-700 via-slate-800 to-slate-700 border-y-2 border-slate-900 relative z-30 shadow-2xl flex items-center justify-center rounded-sm">
                  <div className="h-0.5 w-full bg-white/5 absolute top-1/2 -translate-y-1/2" />
               </div>

               {/* Entry Unit (Left Support) */}
               <div className="absolute left-[-24px] top-1/2 -translate-y-1/2 flex flex-col items-center z-40">
                  <div className="flex items-center gap-2">
                     <div className={`w-16 h-48 bg-slate-900 border-2 border-slate-950 flex flex-col items-center justify-center text-white/40 rounded-lg shadow-2xl`}>
                       <span className="text-[10px] font-black">L-1</span>
                     </div>
                     <div className={`w-10 h-40 border-4 transition-all duration-500 shadow-2xl rounded-lg ${entryLock?.active ? 'bg-rose-500 border-rose-700 shadow-rose-200' : 'bg-emerald-500 border-emerald-700 shadow-emerald-200'}`} />
                  </div>
                  {/* Label below the unit */}
                  <div className={`px-4 py-2 bg-white border border-slate-200 shadow-lg rounded-xl flex items-center gap-3 mt-8 whitespace-nowrap`}>
                     <div className={`w-4 h-4 rounded-full border-2 ${inSensor?.active ? 'bg-rose-500 shadow-[0_0_8px_rose]' : 'bg-slate-200'}`} />
                     <span className="text-[9px] font-black text-slate-800 uppercase tracking-tight">GİRİŞ ÜNİTESİ</span>
                  </div>
               </div>

               {/* Exit Unit (Right Support) */}
               <div className="absolute right-[-24px] top-1/2 -translate-y-1/2 flex flex-col items-center z-40">
                  <div className="flex items-center gap-2">
                     <div className={`w-10 h-40 border-4 transition-all duration-500 shadow-2xl rounded-lg ${exitLock?.active ? 'bg-rose-500 border-rose-700 shadow-rose-200' : 'bg-emerald-500 border-emerald-700 shadow-emerald-200'}`} />
                     <div className={`w-16 h-48 bg-slate-900 border-2 border-slate-950 flex flex-col items-center justify-center text-white/40 rounded-lg shadow-2xl`}>
                       <span className="text-[10px] font-black">L-2</span>
                     </div>
                  </div>
                  {/* Label below the unit */}
                  <div className={`px-4 py-2 bg-white border border-slate-200 shadow-lg rounded-xl flex items-center gap-3 mt-8 whitespace-nowrap`}>
                     <span className="text-[9px] font-black text-slate-800 uppercase tracking-tight">ÇIKIŞ ÜNİTESİ</span>
                     <div className={`w-4 h-4 rounded-full border-2 ${outSensor?.active ? 'bg-rose-500 shadow-[0_0_8px_rose]' : 'bg-slate-200'}`} />
                  </div>
               </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}

// ─── HARDWARE LIST ──────────────────────────────────

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
              <span className="text-slate-300 italic">@{dev.target.toUpperCase()}</span>
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
    <div className="h-full flex flex-col">
      <div className="flex px-10 border-b border-slate-100 shrink-0 bg-white mt-2">
        <MainTabButton active={activeSub === 'inventory'} onClick={() => setActiveSub('inventory')} label="DONANIM ENVANTER PLANI" />
        <MainTabButton active={activeSub === 'process'}   onClick={() => setActiveSub('process')}   label="ÜRETİM PARAMETRE AYARLARI" />
      </div>

      <div className="flex-1 overflow-y-auto p-10 bg-white">
        {activeSub === 'inventory' ? <HardwareInventoryView state={state} apiCall={apiCall} /> : <ProcessSettingsView state={state} apiCall={apiCall} />}
      </div>
    </div>
  );
}

function MainTabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string; }) {
  return (
    <button onClick={onClick} className={`px-8 h-12 flex items-center text-[10px] font-black tracking-[0.2em] transition-all relative ${active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
      {label}
      <div className={`absolute bottom-0 left-8 right-8 h-0.5 bg-blue-600 rounded-full transition-all ${active ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`} />
    </button>
  );
}

function ProcessSettingsView({ state, apiCall }: { state: SystemState; apiCall: any }) {
  return (
    <div className="flex flex-col gap-12 max-w-5xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <InputComponent label="Hattaki Hedef Şişe Adedi" value={state.process.targetBottles} unit="ADET" onChange={v => apiCall('/api/config', { targetBottles: v })} disabled={state.systemRunning} />
        <InputComponent label="Kanal Dolum Bekleme Süresi" value={state.config.fillWaitTime} unit="MS" onChange={v => apiCall('/api/config', { fillWaitTime: v })} disabled={state.systemRunning} />
        <InputComponent label="Lazer Sensör Zaman Aşımı" value={state.config.sensorTimeout} unit="MS" onChange={v => apiCall('/api/config', { sensorTimeout: v })} disabled={state.systemRunning} />
        <InputComponent label="Vardiya Başı Üretim Kotası" value={state.config.dailyQuota} unit="ŞİŞE" onChange={v => apiCall('/api/config', { dailyQuota: v })} disabled={state.systemRunning} />
      </div>

      <div className={`p-10 bg-slate-50 border border-slate-100 ${RADIUS} relative overflow-hidden group`}>
        <div className="flex items-center gap-3 mb-8">
          <div className={`w-2 h-6 bg-blue-500 ${RADIUS}`} />
          <h4 className="text-[11px] font-black text-slate-800 tracking-widest uppercase">OTOMATİK YIKAMA (CIP) RUTİNLERİ</h4>
        </div>
        <div className="flex gap-6 relative z-10">
          <WashActionBtn label="SABAH AÇILIŞ RÜTİNİ" sub="60 SN / Hızlı Yıkama" onClick={() => apiCall('/api/wash', { duration: 60000 })} disabled={state.systemRunning || state.process.state === 'WASHING'} />
          <WashActionBtn label="AKŞAM KAPANIŞ RÜTİNİ" sub="300 SN / Yoğun Deşarj" onClick={() => apiCall('/api/wash', { duration: 300000 })} disabled={state.systemRunning || state.process.state === 'WASHING'} />
        </div>
        {state.process.state === 'WASHING' && (
          <div className="absolute inset-0 bg-blue-600/90 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-4 pointer-events-auto">
            <RefreshCw className="w-10 h-10 animate-spin" />
            <span className="text-2xl font-black tracking-[0.3em] uppercase italic">CIP RUTİNİ İŞLENMEKTE...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function InputComponent({ label, value, unit, onChange, disabled }: { label: string; value: number; unit: string; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">{label}</label>
      <div className="relative">
        <input type="number" disabled={disabled} value={value} onChange={e => onChange(parseInt(e.target.value)||0)}
          className={`w-full h-16 bg-white border-2 border-slate-100 p-5 font-mono font-black text-3xl text-slate-800 outline-none focus:border-blue-500 transition-all ${RADIUS} disabled:opacity-40 shadow-sm`} />
        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-500 uppercase tracking-tighter">{unit}</span>
      </div>
    </div>
  );
}

function WashActionBtn({ label, sub, onClick, disabled }: { label: string; sub: string; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`flex-1 h-32 bg-white border-2 border-slate-100 p-6 flex flex-col items-center justify-center transition-all shadow-sm ${RADIUS} hover:border-slate-800 active:scale-95 disabled:opacity-30 group`}>
      <span className="text-lg font-black text-slate-800 group-hover:text-blue-600 transition-colors uppercase leading-none mb-2">{label}</span>
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{sub}</span>
    </button>
  );
}

// ─── HARDWARE INVENTORY VIEW ───

function HardwareInventoryView({ state, apiCall }: { state: SystemState; apiCall: any }) {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<Partial<Device>>({ type: 'valve', target: 'nano', role: 'none', pin: '', name: '' });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex justify-between items-center bg-slate-50 p-6 border border-slate-100 ${RADIUS}">
        <div className="flex flex-col">
          <h4 className="text-sm font-black text-slate-800 tracking-widest uppercase">ENVANTER KAYIT DEFTERİ</h4>
          <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase italic">{state.devices.length} Birim Sisteme Bağlı</span>
        </div>
        <button onClick={() => setIsAdding(true)} disabled={state.systemRunning} className={`h-12 px-10 bg-slate-900 text-white font-black text-xs uppercase shadow-xl hover:bg-slate-800 active:scale-95 transition-all ${RADIUS} disabled:opacity-30`}>
          YENİ BİRİM TANIMLA
        </button>
      </div>

      {isAdding && (
        <div className={`bg-white border-2 border-slate-800 p-10 grid grid-cols-1 md:grid-cols-3 gap-8 shadow-2xl relative ${RADIUS} animate-in fade-in slide-in-from-top-4 duration-300`}>
          <FormGroup label="Birim Tipi">
            <select className="w-full h-14 border-2 border-slate-100 bg-slate-50 p-4 text-sm font-black outline-none focus:border-blue-500 ${RADIUS}" value={form.type} onChange={e=>setForm({...form, type: e.target.value as any})}>
              <option value="valve">SOLENOID VALF</option>
              <option value="motor">PNÖMATİK AKTÜATÖR</option>
              <option value="laser_sensor">LAZER SENSÖR</option>
            </select>
          </FormGroup>
          <FormGroup label="Haberleşme Sürücüsü">
            <select className="w-full h-14 border-2 border-slate-100 bg-slate-50 p-4 text-sm font-black outline-none focus:border-blue-500 ${RADIUS}" value={form.target} onChange={e=>setForm({...form, target: e.target.value as any})}>
              <option value="nano">PLC OUT (USB BRIDGE)</option>
              <option value="raspi">MASTER (GPIO NATIVE)</option>
            </select>
          </FormGroup>
          <FormGroup label="Lokal Adres (Pin)">
            <input type="text" className="w-full h-14 border-2 border-slate-100 bg-slate-50 p-4 text-sm font-black outline-none focus:border-blue-500 ${RADIUS} uppercase" value={form.pin} onChange={e=>setForm({...form, pin: e.target.value})} placeholder="Ör: D8" />
          </FormGroup>
          <FormGroup label="Görünüm Etiketi (İsim)">
            <input type="text" className="w-full h-14 border-2 border-slate-100 bg-slate-50 p-4 text-sm font-black outline-none focus:border-blue-500 ${RADIUS}" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="Ör: Giriş Pisti Kilidi" />
          </FormGroup>
          <FormGroup label="Proses İşlem Rolü">
            <select className="w-full h-14 border-2 border-slate-100 bg-slate-50 p-4 text-sm font-black outline-none focus:border-blue-500 ${RADIUS}" value={form.role} onChange={e=>setForm({...form, role: e.target.value as any})}>
              <option value="none">SADECE MANUEL TEST</option>
              <option value="entry_laser">ANA GİRİŞ LAZERİ</option>
              <option value="exit_laser">ANA ÇIKIŞ LAZERİ</option>
              <option value="entry_lock">GİRİŞ BARİYERİ</option>
              <option value="exit_lock">ÇIKIŞ BARİYERİ</option>
              {Array.from({length:10}).map((_,i) => <option key={i} value={`valve_${i+1}`}>{i+1}. DOLUM NOZULU</option>)}
            </select>
          </FormGroup>
          <div className="col-span-full flex justify-end gap-3 pt-6">
            <button onClick={()=>setIsAdding(false)} className={`px-10 h-14 text-xs font-black border-2 border-slate-100 ${RADIUS}`}>İPTAL</button>
            <button onClick={() => { apiCall('/api/devices', { device: { ...form, id: Math.random().toString(36).substr(2, 9) } }); setIsAdding(false); }} className={`px-16 h-14 bg-slate-900 text-white text-xs font-black uppercase shadow-xl ${RADIUS}`}>SİSTEME KAYDET</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {state.devices.map(dev => (
          <div key={dev.id} className={`flex items-center justify-between p-6 bg-white border border-slate-100 hover:border-slate-300 transition-all duration-300 shadow-sm ${RADIUS}`}>
            <div className="flex items-center gap-8">
              <div className={`w-14 h-14 flex items-center justify-center border-2 transition-all ${RADIUS} ${dev.active ? 'bg-slate-900 border-slate-950 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                {dev.type === 'valve' ? <Droplet className="w-6 h-6" /> : <Microchip className="w-6 h-6" />}
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-blue-500 uppercase italic mb-0.5">{dev.role}</span>
                <span className="text-base font-black text-slate-800 uppercase leading-none">{dev.name}</span>
                <span className="text-[9px] font-bold text-slate-300 mt-1 uppercase">Bağlantı: {dev.target.toUpperCase()} / {dev.pin}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => apiCall(`/api/devices/${dev.id}/trigger`, {})} className={`h-11 px-8 text-[11px] font-black border-2 border-slate-100 hover:border-slate-800 transition-all ${RADIUS}`}>TEST</button>
              <button disabled={state.systemRunning} onClick={() => apiCall(`/api/devices/${dev.id}`, {}, 'DELETE')} className={`h-11 px-8 text-[11px] font-black border-2 border-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all ${RADIUS}`}>SİL</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}

function EmergencyShutter({ onReset }: { onReset: () => void }) {
  return (
    <div className="absolute inset-0 z-[100] bg-rose-600/95 backdrop-blur-xl flex flex-col items-center justify-center p-20 text-center animate-in fade-in duration-500">
      <div className="bg-white p-12 rounded-full mb-12 shadow-[0_0_100px_rgba(255,255,255,0.4)] animate-bounce">
        <AlertTriangle className="w-32 h-32 text-rose-600" />
      </div>
      <h1 className="text-8xl font-black text-white leading-none uppercase tracking-tighter drop-shadow-lg">SİSTEM DURDURULDU</h1>
      <p className="text-2xl text-rose-100 font-bold uppercase tracking-[0.6em] mt-8 select-none">KRİTİK GÜVENLİK KİLİDİ AKTİF</p>
      <button onClick={onReset} className={`mt-20 px-24 py-8 bg-white text-rose-600 font-black text-3xl shadow-2xl active:scale-95 transition-all ${RADIUS} hover:bg-rose-50`}>
        SİSTEMİ GÜVENLE SIFIRLA
      </button>
    </div>
  );
}
