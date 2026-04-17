import React, { useEffect, useRef, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import {
  Activity, Settings, AlertTriangle, Droplet, Cpu, ScanLine,
  Play, Square, Lock, Unlock, Timer, ToggleRight, ArrowRight,
  ArrowLeft, Terminal, History, Bell, CheckCircle, RefreshCw,
  Maximize2, Minimize2, PlusCircle, Trash2, Send, Watch, Link2
} from 'lucide-react';
import { SystemState, ProductionCycle, Alarm, CustomDevice } from './types';

// ─── Ana Uygulama ─────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState<SystemState | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'system'>('dashboard');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Tam ekran kontrolü
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    // İlk dokunuşta otomatik tam ekran (kiosk modu)
    const autoFs = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      window.removeEventListener('pointerdown', autoFs);
    };
    window.addEventListener('pointerdown', autoFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('pointerdown', autoFs);
    };
  }, []);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res  = await fetch('/api/state');
        const data = await res.json();
        setState(data);
      } catch (e) {
        console.error('State fetch hatası', e);
      }
    };
    fetchState();
    const iv = setInterval(fetchState, 500);
    return () => clearInterval(iv);
  }, []);

  const apiCall = async (endpoint: string, payload: Record<string, unknown>) => {
    try {
      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.error) setState(data);
    } catch (e) {
      console.error(`API hatası: ${endpoint}`, e);
    }
  };

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-slate-500 gap-4">
        <Droplet className="w-16 h-16 text-cyan-500 animate-pulse" />
        <h1 className="text-2xl font-semibold text-slate-700">Sistem Başlatılıyor...</h1>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 text-slate-800 font-sans overflow-hidden select-none touch-manipulation">

      {/* Üst Başlık */}
      <header className="h-[68px] bg-white border-b border-gray-200 shadow-sm flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-cyan-500 rounded-xl flex items-center justify-center shadow-sm">
              <Droplet className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-black text-base text-slate-800 tracking-tight">GAZOZ DOLUM</div>
              <div className="text-xs text-cyan-600 font-semibold">HMI v1.0</div>
            </div>
          </div>
          <nav className="flex gap-1.5">
            <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')}
              icon={<Activity className="w-4 h-4" />} label="Ana Ekran" />
            <TabButton active={activeTab === 'system'}    onClick={() => setActiveTab('system')}
              icon={<Settings className="w-4 h-4" />}  label="Sistem" />
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {state.hasError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 animate-pulse text-sm font-bold">
              <AlertTriangle className="w-4 h-4" /> SİSTEM HATASI
            </div>
          )}
          <div className={`flex items-center gap-2 text-sm font-semibold ${state.systemRunning ? 'text-emerald-600' : 'text-slate-400'}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${state.systemRunning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className="hidden md:block">{state.systemRunning ? 'ÇALIŞIYOR' : 'BEKLEMEDE'}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-95 border border-gray-200 text-slate-500 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          <button
            onClick={() => apiCall('/api/system', { running: !state.systemRunning })}
            disabled={state.emergencyStop}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 min-h-[44px] border ${
              state.emergencyStop
                ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200'
                : state.systemRunning
                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-300'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-300'
            }`}
          >
            {state.systemRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            {state.systemRunning ? 'DURDUR' : 'BAŞLAT'}
          </button>

          <button
            onClick={() => apiCall('/api/estop', { active: !state.emergencyStop })}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 min-h-[44px] border-2 ${
              state.emergencyStop
                ? 'bg-red-600 text-white border-red-700 animate-pulse shadow-lg shadow-red-200'
                : 'bg-red-50 text-red-600 border-red-300 hover:bg-red-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4" /> ACİL STOP
          </button>
        </div>
      </header>

      {/* Ana İçerik */}
      <main className="flex-1 flex flex-col p-4 relative overflow-hidden">

        {/* Acil Stop Overlay */}
        {state.emergencyStop && (
          <div className="absolute inset-0 z-50 bg-red-600/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
            <AlertTriangle className="w-28 h-28 text-white animate-bounce" />
            <h1 className="text-5xl font-black text-white tracking-widest">ACİL STOP AKTİF</h1>
            <p className="text-lg text-red-100">Tüm sistem durduruldu. Valfler ve motorlar kilitli.</p>
            <button
              onClick={() => apiCall('/api/estop', { active: false })}
              className="mt-4 px-10 py-4 bg-white hover:bg-gray-100 active:scale-95 text-red-600 rounded-2xl font-bold text-xl border-2 border-white transition-all min-h-[60px] shadow-lg"
            >
              SİSTEMİ SIFIRLA VE KİLİDİ AÇ
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && <DashboardView state={state} apiCall={apiCall} />}
        {activeTab === 'system'    && <SystemView    state={state} apiCall={apiCall} />}
      </main>
    </div>
  );
}

// ─── Sekme Butonu ─────────────────────────────────────────────────────────────
function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-semibold text-sm active:scale-95 min-h-[40px] border ${
        active
          ? 'bg-cyan-50 text-cyan-700 border-cyan-300 shadow-sm'
          : 'text-slate-500 hover:bg-gray-100 border-transparent hover:border-gray-200'
      }`}
    >
      {icon}<span>{label}</span>
    </button>
  );
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────
function DashboardView({ state, apiCall }: { state: SystemState; apiCall: (e: string, p: Record<string, unknown>) => void }) {
  const processLabels: Record<string, { text: string; color: string; bg: string; border: string }> = {
    WAITING_BOTTLES: { text: 'ŞİŞELER BEKLENİYOR',  color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
    PRE_FILL_WAIT:   { text: 'DOLUM ÖNCESİ BEKLEME', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
    FILLING:         { text: 'DOLUM YAPILIYOR',        color: 'text-cyan-700',    bg: 'bg-cyan-50',    border: 'border-cyan-200' },
    POST_FILL_WAIT:  { text: 'DOLUM SONRASI BEKLEME', color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200' },
    EXITING_BOTTLES: { text: 'ŞİŞELER ÇIKIYOR',       color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  };
  const proc = processLabels[state.process.state];

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      {/* Durum Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <StatusCard title="Süreç Durumu"         value={proc.text}
          icon={<Activity className={`w-7 h-7 ${proc.color}`} />} color="blue"
          customValueClass={`text-base font-bold font-mono ${proc.color}`} />
        <StatusCard title="Dolum Alanındaki Şişe" value={`${state.process.bottlesInArea} / ${state.config.targetBottles}`}
          icon={<Droplet className="w-7 h-7 text-cyan-600" />} color="cyan" />
        <StatusCard title="Toplam Giren"          value={state.sensors[0].count.toString()}
          icon={<ScanLine className="w-7 h-7 text-emerald-600" />} color="emerald" />
        <StatusCard title="Toplam Çıkan"          value={state.sensors[1].count.toString()}
          icon={<ScanLine className="w-7 h-7 text-purple-600" />} color="purple" />
      </div>

      {/* Hat Görselleştirme */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-slate-700">
          <Activity className="w-5 h-5 text-slate-400" /> Hat Durumu
        </h3>
        <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200 relative overflow-hidden p-6">

          {/* Konveyör Bandı */}
          <div className="absolute bottom-8 left-8 right-8 h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
            <div
              className={`h-full w-full bg-gray-300 ${state.motors[0].running ? 'animate-conveyor' : ''}`}
              style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(0,0,0,0.08) 20px, rgba(0,0,0,0.08) 40px)' }}
            />
          </div>

          <div className="w-full flex justify-between items-end pb-14 px-2 relative z-10">

            {/* Giriş */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold tracking-wide">GİRİŞ</span>
              <div className={`w-4 h-14 rounded-t-md shadow-sm ${state.systemRunning ? 'bg-emerald-400' : 'bg-gray-300'}`} />
              <div className="relative flex items-center justify-center">
                {/* Giriş Lazer */}
                <div className="absolute right-full mr-2 flex flex-col items-center bottom-0">
                  <div className={`w-0.5 h-16 transition-colors ${state.sensors[0].active ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]' : 'bg-red-200'}`} />
                  <div className="w-6 h-6 bg-white rounded border-2 border-gray-300 flex flex-col items-center justify-start pt-0.5 mt-1 shadow-sm">
                    <div className={`w-1.5 h-1.5 rounded-full ${state.sensors[0].active ? 'bg-red-500' : 'bg-red-200'}`} />
                    <span className="text-[9px] font-bold text-slate-400">S</span>
                  </div>
                </div>
                {/* Giriş Kilidi */}
                <div className={`w-12 h-14 border-2 rounded-xl flex flex-col items-center justify-center transition-colors shadow-sm ${state.locks.entry ? 'bg-red-50 border-red-400 text-red-600' : 'bg-emerald-50 border-emerald-400 text-emerald-600'}`}>
                  {state.locks.entry ? <Lock className="w-5 h-5 mb-1" /> : <Unlock className="w-5 h-5 mb-1" />}
                  <span className="text-[9px] font-bold">Kilit</span>
                </div>
              </div>
            </div>

            {/* Dolum Alanı */}
            <div className="flex flex-col items-center flex-1 px-6">
              <div className="flex justify-between w-full mb-3 px-4">
                {state.valves.map((v, i) => (
                  <div key={i} className={`w-3 h-10 rounded-b-md transition-all ${v ? 'bg-cyan-500 shadow-[0_4px_12px_rgba(6,182,212,0.5)]' : 'bg-gray-200'}`} />
                ))}
              </div>
              <div className="flex justify-between w-full px-2 h-14 items-end">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className={`w-5 transition-all duration-300 rounded-t-sm ${i < state.process.bottlesInArea ? 'h-11 bg-cyan-100 border-2 border-cyan-400' : 'h-0'}`}>
                    <div className={`w-full bg-cyan-400 transition-all duration-1000 ${state.process.state === 'FILLING' && i < state.process.bottlesInArea ? 'h-full' : 'h-0'}`} />
                  </div>
                ))}
              </div>
              <div className="w-full h-7 border-t-4 border-gray-300 mt-1 flex items-center justify-center">
                <span className="text-slate-400 font-bold text-xs">DOLUM ALANI (10 ŞİŞE)</span>
              </div>
            </div>

            {/* Çıkış */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold tracking-wide">ÇIKIŞ</span>
              <div className={`w-4 h-14 rounded-t-md shadow-sm ${state.systemRunning ? 'bg-purple-400' : 'bg-gray-300'}`} />
              <div className="relative flex items-center justify-center">
                {/* Çıkış Kilidi */}
                <div className={`w-12 h-14 border-2 rounded-xl flex flex-col items-center justify-center transition-colors shadow-sm ${state.locks.exit ? 'bg-red-50 border-red-400 text-red-600' : 'bg-emerald-50 border-emerald-400 text-emerald-600'}`}>
                  {state.locks.exit ? <Lock className="w-5 h-5 mb-1" /> : <Unlock className="w-5 h-5 mb-1" />}
                  <span className="text-[9px] font-bold">Kilit</span>
                </div>
                {/* Çıkış Lazer */}
                <div className="absolute left-full ml-2 flex flex-col items-center bottom-0">
                  <div className={`w-0.5 h-16 transition-colors ${state.sensors[1].active ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]' : 'bg-red-200'}`} />
                  <div className="w-6 h-6 bg-white rounded border-2 border-gray-300 flex flex-col items-center justify-start pt-0.5 mt-1 shadow-sm">
                    <div className={`w-1.5 h-1.5 rounded-full ${state.sensors[1].active ? 'bg-red-500' : 'bg-red-200'}`} />
                    <span className="text-[9px] font-bold text-slate-400">S</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sistem Görünümü ─────────────────────────────────────────────────────────
function SystemView({ state, apiCall }: { state: SystemState; apiCall: (e: string, p: Record<string, unknown>) => void }) {
  const [sysTab, setSysTab] = useState<'settings' | 'hardware' | 'test' | 'rpi' | 'nano' | 'history' | 'alarms'>('settings');
  const [hwTab,  setHwTab]  = useState<'sensors' | 'switches' | 'entry_lock' | 'exit_lock' | 'valves'>('sensors');

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <div className="flex gap-1.5 border-b border-gray-200 pb-3 overflow-x-auto">
        <TabButton active={sysTab === 'settings'} onClick={() => setSysTab('settings')} icon={<Settings className="w-4 h-4" />} label="Ayarlar" />
        <TabButton active={sysTab === 'hardware'} onClick={() => setSysTab('hardware')} icon={<Cpu      className="w-4 h-4" />} label="Donanım" />
        <TabButton active={sysTab === 'test'}     onClick={() => setSysTab('test')}     icon={<Activity className="w-4 h-4" />} label="Test" />
        <TabButton active={sysTab === 'custom'}   onClick={() => setSysTab('custom')}   icon={<PlusCircle className="w-4 h-4" />} label="Ekstra Donanımlar" />
        <TabButton active={sysTab === 'rpi'}      onClick={() => setSysTab('rpi')}      icon={<Terminal className="w-4 h-4" />} label="RPi" />
        <TabButton active={sysTab === 'nano'}     onClick={() => setSysTab('nano')}     icon={<Terminal className="w-4 h-4" />} label="Nano" />
        <TabButton active={sysTab === 'history'}  onClick={() => setSysTab('history')}  icon={<History  className="w-4 h-4" />} label="Geçmiş" />
        <TabButton active={sysTab === 'alarms'}   onClick={() => setSysTab('alarms')}   icon={<Bell     className="w-4 h-4" />} label="Alarmlar" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {sysTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-semibold mb-5 flex items-center gap-2 text-slate-700">
                <Timer className="w-5 h-5 text-slate-400" /> Zaman &amp; Hacim Ayarları
              </h3>
              <div className="flex flex-col gap-6">
                <SliderField label="Dolum Öncesi Bekleme" value={state.config.fillWaitTime}
                  unit="sn" min={1} max={10} step={1} color="amber"
                  disabled={state.systemRunning}
                  onChange={(v) => apiCall('/api/config', { fillWaitTime: v })} />
                <SliderField label="Şişe Hacmi" value={state.config.syrupVolume}
                  unit="ml" min={10} max={500} step={10} color="cyan"
                  disabled={state.systemRunning}
                  onChange={(v) => apiCall('/api/config', { syrupVolume: v })} />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-semibold mb-5 flex items-center gap-2 text-slate-700">
                <Droplet className="w-5 h-5 text-slate-400" /> Valf Dolum Süreleri (sn)
              </h3>
              <div className="grid grid-cols-5 gap-2">
                {state.config.valveFillTimes.map((time, idx) => (
                  <div key={idx} className="flex flex-col items-center bg-gray-50 p-2 rounded-xl border border-gray-200">
                    <span className="text-[10px] text-slate-400 font-semibold mb-1">V{idx + 1}</span>
                    <input
                      type="number" min={0.5} max={30} step={0.5}
                      value={time} disabled={state.systemRunning}
                      onChange={(e) => {
                        const t = [...state.config.valveFillTimes];
                        t[idx] = parseFloat(e.target.value) || 1;
                        apiCall('/api/config', { valveFillTimes: t });
                      }}
                      className="w-full bg-white text-center text-sm font-mono text-cyan-700 border border-gray-300 rounded-lg p-1.5 focus:outline-none focus:border-cyan-400 disabled:opacity-50 min-h-[40px]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {sysTab === 'hardware' && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-1.5 border-b border-gray-200 pb-3 overflow-x-auto">
              <TabButton active={hwTab === 'sensors'}    onClick={() => setHwTab('sensors')}    icon={<ScanLine    className="w-4 h-4" />} label="Sensörler" />
              <TabButton active={hwTab === 'switches'}   onClick={() => setHwTab('switches')}   icon={<ToggleRight className="w-4 h-4" />} label="Limit SW" />
              <TabButton active={hwTab === 'entry_lock'} onClick={() => setHwTab('entry_lock')} icon={<Lock        className="w-4 h-4" />} label="Giriş Kilidi" />
              <TabButton active={hwTab === 'exit_lock'}  onClick={() => setHwTab('exit_lock')}  icon={<Lock        className="w-4 h-4" />} label="Çıkış Kilidi" />
              <TabButton active={hwTab === 'valves'}     onClick={() => setHwTab('valves')}     icon={<Droplet     className="w-4 h-4" />} label="Valfler" />
            </div>
            {hwTab === 'sensors'    && <SensorsView      state={state} apiCall={apiCall} />}
            {hwTab === 'switches'   && <LimitSwitchesView state={state} apiCall={apiCall} />}
            {hwTab === 'entry_lock' && <SingleMotorView motor={state.motors[1]} dataKey="speed" color="#0891b2" apiCall={apiCall} state={state} />}
            {hwTab === 'exit_lock'  && <SingleMotorView motor={state.motors[2]} dataKey="speed" color="#7c3aed" apiCall={apiCall} state={state} />}
            {hwTab === 'valves'     && <ValvesView       state={state} apiCall={apiCall} />}
          </div>
        )}

        {sysTab === 'test'    && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><TestView state={state} apiCall={apiCall} /></div>}
        {sysTab === 'custom'  && <CustomHardwareView state={state} apiCall={apiCall} />}
        {sysTab === 'rpi'     && <HardwareTerminalView target="rpi"  title="Raspberry Pi"  state={state} apiCall={apiCall} />}
        {sysTab === 'nano'    && <HardwareTerminalView target="nano" title="Arduino Nano"  state={state} apiCall={apiCall} />}
        {sysTab === 'history' && <ProductionHistoryView />}
        {sysTab === 'alarms'  && <AlarmsView />}
      </div>
    </div>
  );
}

// ─── Slider Alanı ─────────────────────────────────────────────────────────────
function SliderField({ label, value, unit, min, max, step, color, disabled, onChange }: {
  label: string; value: number; unit: string; min: number; max: number; step: number;
  color: string; disabled: boolean; onChange: (v: number) => void;
}) {
  const accentMap: Record<string, string> = { amber: 'accent-amber-500', cyan: 'accent-cyan-500', emerald: 'accent-emerald-500' };
  const valueColorMap: Record<string, string> = { amber: 'text-amber-600', cyan: 'text-cyan-600', emerald: 'text-emerald-600' };
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <label className="text-sm font-medium text-slate-600">{label}</label>
        <span className={`text-lg font-mono font-bold ${valueColorMap[color] || 'text-slate-700'}`}>{value} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer ${accentMap[color] || 'accent-cyan-500'} disabled:opacity-40`}
      />
    </div>
  );
}

// ─── Test Görünümü ────────────────────────────────────────────────────────────
function TestView({ state, apiCall }: { state: SystemState; apiCall: (e: string, p: Record<string, unknown>) => void }) {
  return (
    <>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-semibold mb-5 flex items-center gap-2 text-slate-700">
          <Lock className="w-5 h-5 text-slate-400" /> Kilit Testi
        </h3>
        <div className="flex gap-3">
          {(['entry', 'exit'] as const).map((t) => (
            <button key={t}
              onClick={() => apiCall('/api/locks/toggle', { type: t, open: state.locks[t] })}
              disabled={state.systemRunning}
              className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-40 flex flex-col items-center gap-2 min-h-[80px] shadow-sm"
            >
              <span className="font-semibold text-slate-700">{t === 'entry' ? 'Giriş' : 'Çıkış'} Kilidi</span>
              <span className={`text-xs px-2 py-1 rounded-lg font-bold border ${state.locks[t] ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                {state.locks[t] ? 'KAPALI' : 'AÇIK'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-semibold mb-5 flex items-center gap-2 text-slate-700">
          <Droplet className="w-5 h-5 text-slate-400" /> Valf Dolum Süresi Testi
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {state.valves.map((isActive, idx) => (
            <button key={idx}
              onClick={() => apiCall('/api/valves/test', { index: idx })}
              disabled={state.systemRunning || isActive}
              className={`p-3 rounded-xl border transition-all active:scale-95 flex flex-col items-center gap-1.5 min-h-[68px] shadow-sm ${isActive ? 'bg-cyan-50 border-cyan-300 text-cyan-700' : 'bg-gray-50 border-gray-200 hover:border-gray-300 text-slate-700'} disabled:opacity-40`}
            >
              <span className="font-bold text-sm">V{idx + 1} Test</span>
              <span className="text-xs text-slate-400">{state.config.valveFillTimes[idx]} sn</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Tekli Motor Görünümü ─────────────────────────────────────────────────────
function SingleMotorView({ motor, dataKey, color, apiCall, state }: {
  motor: SystemState['motors'][0]; dataKey: string; color: string;
  apiCall: (e: string, p: Record<string, unknown>) => void; state: SystemState;
}) {
  const [history, setHistory] = useState<{ time: string; speed: number }[]>([]);
  const motorRef = useRef(motor);
  useEffect(() => { motorRef.current = motor; }, [motor]);

  useEffect(() => {
    const iv = setInterval(() => {
      const m = motorRef.current;
      const timeStr = new Date().toLocaleTimeString('tr-TR');
      setHistory(prev => {
        const next = [...prev, { time: timeStr, speed: m.running ? m.speed : 0 }];
        if (next.length > 120) next.shift();
        return next;
      });
    }, 500);
    return () => clearInterval(iv);
  }, []);

  const fmtTime = (s: number) =>
    `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor((s % 3600) / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-5 shadow-sm">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${motor.running ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
              <Cpu className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">{motor.name}</h3>
              <p className="text-slate-500 font-mono text-sm mt-0.5">
                Step Motor · <span className="text-purple-600">{fmtTime(motor.runningTime || 0)}</span>
              </p>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${motor.running ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            {motor.running ? 'ÇALIŞIYOR' : 'DURDU'}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-2">
            <label className="text-sm font-medium text-slate-600">Motor Hızı</label>
            <span className="text-xl font-mono font-bold text-cyan-600">{motor.speed}%</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 rounded-full" style={{ width: `${motor.speed}%` }} />
          </div>
        </div>

        {motor.steps !== undefined && (
          <SliderField label="Adım (Step) Ayarı" value={motor.steps} unit="Adım"
            min={50} max={1000} step={10} color="amber" disabled={state.systemRunning}
            onChange={(v) => apiCall(`/api/motors/${motor.id}`, { steps: v })} />
        )}

        <div>
          <label className="text-sm font-medium text-slate-600 mb-2 block">Dönüş Yönü</label>
          <div className="flex gap-2">
            {(['forward', 'reverse'] as const).map((dir) => (
              <div key={dir} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold min-h-[44px] ${motor.direction === dir ? 'bg-cyan-50 border-cyan-300 text-cyan-700' : 'bg-gray-50 border-gray-200 text-slate-400'}`}>
                {dir === 'forward' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                {dir === 'forward' ? 'İLERİ (AÇ)' : 'GERİ (KAPAT)'}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 h-[340px] flex flex-col shadow-sm">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-slate-700">
          <Activity className="w-5 h-5 text-slate-400" /> Hız Grafiği (Son 1 Dk)
        </h3>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickMargin={8} minTickGap={30} />
              <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
              <RechartsTooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '0.5rem', color: '#1e293b' }} />
              <Line type="monotone" dataKey="speed" name={motor.name} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Sensör Görünümü ──────────────────────────────────────────────────────────
function SensorsView({ state, apiCall }: { state: SystemState; apiCall: (e: string, p: Record<string, unknown>) => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-base font-semibold mb-5 flex items-center gap-2 text-slate-700">
        <ScanLine className="w-5 h-5 text-slate-400" /> Lazer Sensörler
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.sensors.map((sensor) => (
          <div key={sensor.id} className={`flex flex-col gap-4 p-5 rounded-xl border transition-colors ${sensor.active ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-sm font-medium text-slate-600">{sensor.name}</span>
                <span className="text-3xl font-bold font-mono text-slate-800 mt-1 block">{sensor.count}</span>
              </div>
              <div className={`w-4 h-4 rounded-full ${sensor.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-gray-300'}`} />
            </div>
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => apiCall('/api/sensors/toggle', { id: sensor.id, blocked: !sensor.blocked })}
                disabled={state.systemRunning}
                className={`w-full py-2.5 rounded-xl border transition-all active:scale-95 text-sm font-bold flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-40 ${sensor.blocked ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100' : 'bg-white border-gray-300 text-slate-600 hover:bg-gray-50'}`}
              >
                {sensor.blocked ? 'ENGELİ KALDIR' : 'ENGEL KOY (TEST)'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Limit Switch Görünümü ────────────────────────────────────────────────────
function LimitSwitchesView({ state }: { state: SystemState; apiCall: (e: string, p: Record<string, unknown>) => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-base font-semibold mb-5 flex items-center gap-2 text-slate-700">
        <ToggleRight className="w-5 h-5 text-slate-400" /> Limit Switchler
      </h3>
      <div className="flex flex-col gap-3">
        {state.limitSwitches.map((ls) => (
          <div key={ls.id} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl min-h-[60px]">
            <div>
              <span className="text-sm font-medium text-slate-700">{ls.name}</span>
              <span className="text-xs text-slate-400 font-mono block mt-0.5">{ls.id}</span>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${ls.active ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
              {ls.active ? 'AKTİF' : 'PASİF'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Valf Görünümü ────────────────────────────────────────────────────────────
function ValvesView({ state, apiCall }: { state: SystemState; apiCall: (e: string, p: Record<string, unknown>) => void }) {
  const [simTime, setSimTime] = useState<number>(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setSimTime(Date.now()), 100);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-base font-semibold flex items-center gap-2 text-slate-700">
          <Droplet className="w-5 h-5 text-slate-400" /> Selenoid Valf Kontrolü
        </h3>
        <span className="text-slate-500 bg-gray-50 px-3 py-1.5 rounded-lg font-mono border border-gray-200 text-sm">10 Valf</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {state.valves.map((isActive, idx) => (
          <ValveButton key={idx} isActive={isActive} index={idx}
            disabled={state.emergencyStop} simTime={simTime}
            onClick={() => apiCall(`/api/valves/${idx}`, { active: !isActive })} />
        ))}
      </div>
    </div>
  );
}

// ─── Valf Butonu ─────────────────────────────────────────────────────────────
interface ValveButtonProps { key?: React.Key; isActive: boolean; index: number; disabled: boolean; simTime: number; onClick: () => void; }
function ValveButton({ isActive, index, disabled, simTime, onClick }: ValveButtonProps) {
  const noiseRef = useRef(Math.random() * 0.8);
  const flowRate = isActive ? 45 + Math.sin(simTime / 500 + index) * 2 + noiseRef.current : 0;

  return (
    <button
      title={`Valf ${index + 1}: ${isActive ? 'Açık' : 'Kapalı'}`}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all active:scale-95 min-h-[110px] shadow-sm ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${isActive ? 'bg-cyan-50 border-cyan-400 shadow-cyan-100' : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-white'}`}
    >
      <div className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full ${isActive ? 'bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'bg-gray-300'}`} />
      <Droplet className={`w-7 h-7 mb-1.5 ${isActive ? 'text-cyan-500' : 'text-gray-300'}`} />
      <span className={`font-bold text-sm ${isActive ? 'text-cyan-700' : 'text-slate-600'}`}>VALF {index + 1}</span>
      <div className={`mt-1.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${isActive ? 'bg-cyan-100 text-cyan-700 border-cyan-300' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-cyan-500 animate-pulse' : 'bg-gray-300'}`} />
        {isActive ? 'AÇIK' : 'KAPALI'}
      </div>
      {isActive && (
        <div className="mt-1.5 text-[10px] font-mono text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 flex items-center gap-1">
          <Activity className="w-3 h-3" />
          {flowRate.toFixed(1)} L/dk
        </div>
      )}
    </button>
  );
}

// ─── Durum Kartı ──────────────────────────────────────────────────────────────
function StatusCard({ title, value, icon, color, customValueClass }: {
  title: string; value: string; icon: React.ReactNode; color: string; customValueClass?: string;
}) {
  const colors: Record<string, string> = {
    blue:    'bg-blue-50 border-blue-200',
    purple:  'bg-purple-50 border-purple-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    cyan:    'bg-cyan-50 border-cyan-200',
  };
  return (
    <div className={`p-5 rounded-2xl border ${colors[color] || 'bg-gray-50 border-gray-200'} flex items-center justify-between min-h-[88px] shadow-sm`}>
      <div>
        <div className="text-slate-500 text-xs font-semibold mb-1">{title}</div>
        <div className={customValueClass || 'text-2xl font-bold font-mono text-slate-800'}>{value}</div>
      </div>
      <div className="p-2.5 bg-white rounded-xl shadow-sm">{icon}</div>
    </div>
  );
}

// ─── Donanım Terminal ─────────────────────────────────────────────────────────
function HardwareTerminalView({ target, title, state, apiCall }: {
  target: 'rpi' | 'nano'; title: string; state: SystemState;
  apiCall: (e: string, p: Record<string, unknown>) => void;
}) {
  const [logs, setLogs] = useState<{ time: string; type: 'in' | 'out' | 'info'; text: string }[]>([
    { time: new Date().toLocaleTimeString('tr-TR'), type: 'info', text: `${title} terminaline bağlandı...` },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const hwState = state.hardware?.[target] || { connected: false, port: '', status: 'Bilinmiyor', baudRate: 9600, simulated: false };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const cmd = input.trim();
    setInput('');
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('tr-TR'), type: 'out', text: cmd }]);
    try {
      const res  = await fetch('/api/terminal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, command: cmd }),
      });
      const data = await res.json();
      if (data.response) {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('tr-TR'), type: 'in', text: data.response }]);
      }
    } catch {
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('tr-TR'), type: 'info', text: 'Hata: Komut gönderilemedi.' }]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[520px]">
      <div className="col-span-1 bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
        <h3 className="text-base font-semibold flex items-center gap-2 text-slate-700">
          <Settings className="w-5 h-5 text-slate-400" /> Bağlantı
        </h3>
        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
          <span className="text-slate-500 text-sm">Durum</span>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${hwState.connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
            <span className={`font-bold text-sm ${hwState.connected ? 'text-emerald-600' : 'text-red-500'}`}>
              {hwState.connected ? 'BAĞLI' : 'KOPUK'}
            </span>
          </div>
        </div>
        {'simulated' in hwState && hwState.simulated && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-amber-700 text-xs font-bold text-center">
            SİMÜLASYON MODU
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Port</label>
          <input type="text" value={hwState.port}
            onChange={(e) => apiCall('/api/hardware/config', { target, config: { port: e.target.value } })}
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-slate-700 font-mono text-sm focus:outline-none focus:border-cyan-400 min-h-[44px]"
            placeholder={target === 'nano' ? '/dev/ttyUSB0' : 'GPIO'}
          />
        </div>
        {target === 'nano' && (
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Baud Rate</label>
            <select value={'baudRate' in hwState ? hwState.baudRate : 9600}
              onChange={(e) => apiCall('/api/hardware/config', { target, config: { baudRate: parseInt(e.target.value) } })}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-slate-700 font-mono text-sm focus:outline-none focus:border-cyan-400 min-h-[44px]"
            >
              {[9600, 19200, 38400, 57600, 115200].map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}
        <div className="mt-auto">
          <button
            onClick={() => apiCall('/api/hardware/config', { target, config: { connected: !hwState.connected } })}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 min-h-[44px] border ${hwState.connected ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'}`}
          >
            {hwState.connected ? 'BAĞLANTIYI KES' : 'BAĞLAN'}
          </button>
        </div>
      </div>

      {/* Terminal — karanlık kalsın (terminaler her zaman siyah olur) */}
      <div className="col-span-1 lg:col-span-2 bg-slate-900 border border-slate-700 rounded-2xl p-5 flex flex-col">
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2 text-slate-200">
          <Terminal className="w-5 h-5 text-slate-400" /> {title} Terminali
        </h3>
        <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-sm overflow-y-auto mb-3 flex flex-col gap-1">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-slate-600 shrink-0">[{log.time}]</span>
              {log.type === 'info' && <span className="text-slate-400 italic">{log.text}</span>}
              {log.type === 'out'  && <span className="text-cyan-400"><span className="text-slate-600 mr-1">&gt;</span>{log.text}</span>}
              {log.type === 'in'   && <span className="text-emerald-400"><span className="text-slate-600 mr-1">&lt;</span>{log.text}</span>}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={handleSend} className="flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Komut girin (ör: STATUS, PING)..."
            disabled={!hwState.connected}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 font-mono text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50 min-h-[44px]"
          />
          <button type="submit" disabled={!hwState.connected}
            className="bg-cyan-600 text-white border border-cyan-700 px-5 py-3 rounded-xl font-bold text-sm hover:bg-cyan-700 active:scale-95 transition-all disabled:opacity-40 min-h-[44px]"
          >
            GÖNDER
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Üretim Geçmişi ───────────────────────────────────────────────────────────
function ProductionHistoryView() {
  const [cycles, setCycles] = useState<ProductionCycle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try { setCycles(await (await fetch('/api/history')).json()); }
    catch {/* ignore */} finally { setLoading(false); }
  };

  useEffect(() => { fetchHistory(); const iv = setInterval(fetchHistory, 10000); return () => clearInterval(iv); }, []);

  const statusLabel: Record<string, { label: string; cls: string }> = {
    running:     { label: 'DEVAM EDİYOR', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    completed:   { label: 'TAMAMLANDI',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    interrupted: { label: 'KESİLDİ',      cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    estop:       { label: 'ACİL STOP',    cls: 'bg-red-50 text-red-700 border-red-200' },
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-base font-semibold flex items-center gap-2 text-slate-700">
          <History className="w-5 h-5 text-slate-400" /> Üretim Geçmişi
        </h3>
        <button onClick={fetchHistory} className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 active:scale-95 border border-gray-200 transition-all rounded-xl text-sm font-semibold text-slate-600 min-h-[40px]">
          <RefreshCw className="w-4 h-4" /> Yenile
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Yükleniyor...
        </div>
      ) : cycles.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
          <History className="w-10 h-10" /><p>Henüz üretim kaydı yok.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-3 font-semibold rounded-tl-lg">#</th>
                <th className="text-left py-3 px-3 font-semibold">Başlangıç</th>
                <th className="text-left py-3 px-3 font-semibold">Bitiş</th>
                <th className="text-center py-3 px-3 font-semibold">Giren</th>
                <th className="text-center py-3 px-3 font-semibold">Çıkan</th>
                <th className="text-center py-3 px-3 font-semibold rounded-tr-lg">Durum</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => {
                const s = statusLabel[c.status] || statusLabel.completed;
                return (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-400 text-xs">{c.id}</td>
                    <td className="py-3 px-3 font-mono text-slate-600 text-xs">{c.started_at}</td>
                    <td className="py-3 px-3 font-mono text-slate-400 text-xs">{c.completed_at || '—'}</td>
                    <td className="py-3 px-3 text-center font-mono text-emerald-600 font-bold">{c.bottles_in}</td>
                    <td className="py-3 px-3 text-center font-mono text-purple-600 font-bold">{c.bottles_out}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${s.cls}`}>{s.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Alarmlar ─────────────────────────────────────────────────────────────────
function AlarmsView() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlarms = async () => {
    setLoading(true);
    try { setAlarms(await (await fetch('/api/alarms')).json()); }
    catch {/* ignore */} finally { setLoading(false); }
  };

  const resolveAlarm = async (id: number) => {
    await fetch(`/api/alarms/${id}/resolve`, { method: 'POST' });
    fetchAlarms();
  };

  useEffect(() => { fetchAlarms(); const iv = setInterval(fetchAlarms, 5000); return () => clearInterval(iv); }, []);

  const typeStyle: Record<string, { cls: string; icon: React.ReactNode }> = {
    ESTOP:        { cls: 'bg-red-50 text-red-700 border-red-200',           icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    SENSOR_FAULT: { cls: 'bg-amber-50 text-amber-700 border-amber-200',     icon: <ScanLine      className="w-3.5 h-3.5" /> },
    MOTOR_FAULT:  { cls: 'bg-orange-50 text-orange-700 border-orange-200',  icon: <Cpu           className="w-3.5 h-3.5" /> },
    INFO:         { cls: 'bg-blue-50 text-blue-700 border-blue-200',        icon: <Activity      className="w-3.5 h-3.5" /> },
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-base font-semibold flex items-center gap-2 text-slate-700">
          <Bell className="w-5 h-5 text-slate-400" /> Alarm Kayıtları
          {alarms.filter(a => !a.resolved_at).length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {alarms.filter(a => !a.resolved_at).length}
            </span>
          )}
        </h3>
        <button onClick={fetchAlarms} className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 active:scale-95 border border-gray-200 transition-all rounded-xl text-sm font-semibold text-slate-600 min-h-[40px]">
          <RefreshCw className="w-4 h-4" /> Yenile
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Yükleniyor...
        </div>
      ) : alarms.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
          <p>Alarm yok. Her şey yolunda!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {alarms.map((alarm) => {
            const ts = typeStyle[alarm.type] || typeStyle.INFO;
            const resolved = !!alarm.resolved_at;
            return (
              <div key={alarm.id} className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${resolved ? 'bg-gray-50 border-gray-200 opacity-50' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${ts.cls}`}>
                    {ts.icon} {alarm.type}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{alarm.message}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{alarm.created_at}</p>
                  </div>
                </div>
                {!resolved ? (
                  <button
                    onClick={() => resolveAlarm(alarm.id)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all min-h-[40px] shrink-0 ml-3"
                  >
                    <CheckCircle className="w-4 h-4" /> Kapat
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 font-mono ml-3 shrink-0">{alarm.resolved_at}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Ekstra Donanımlar ────────────────────────────────────────────────────────
function CustomHardwareView({ state, apiCall }: { state: SystemState; apiCall: (e: string, p: Record<string, unknown>) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<CustomDevice>>({
    name: '', type: 'sensor', pin: '', command: '', responsePrefix: '', autoMode: false, pollIntervalSec: 3
  });

  const handleSave = () => {
    if (!formData.name) return alert('İsim girmelisiniz');
    const device: CustomDevice = {
      id: crypto.randomUUID(),
      name: formData.name,
      type: formData.type as 'sensor' | 'actuator',
      pin: formData.pin || 'Yok',
      command: formData.command || '',
      responsePrefix: formData.responsePrefix || '',
      autoMode: formData.autoMode || false,
      pollIntervalSec: formData.pollIntervalSec || 1,
      lastValue: null,
      lastUpdate: null,
    };
    fetch('/api/custom-hardware', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device }) });
    setShowForm(false);
  };

  const handleTrigger = (id: string) => {
    fetch(`/api/custom-hardware/${id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  };

  const handleDelete = (id: string) => {
    if (confirm('Donanımı silmek istediğinize emin misiniz?')) {
      fetch(`/api/custom-hardware/${id}`, { method: 'DELETE' });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {showForm ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-semibold mb-5 flex items-center gap-2 text-slate-700">
            <PlusCircle className="w-5 h-5 text-slate-400" /> Yeni Donanım Tanımla
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Donanım Adı</label>
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Örn: Sıcaklık Sensörü" className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Tip</label>
              <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as 'sensor' | 'actuator' })}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
                <option value="sensor">Sensör (Okuma)</option>
                <option value="actuator">Aktüatör (Kontrol/Tetik)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Pin (Bilgi Amaçlı)</label>
              <input type="text" value={formData.pin} onChange={e => setFormData({ ...formData, pin: e.target.value })}
                placeholder="A0, D4 vb." className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Gönderilecek Komut (Varsa)</label>
              <input type="text" value={formData.command} onChange={e => setFormData({ ...formData, command: e.target.value })}
                placeholder="Örn: READ_TEMP" className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Beklenen Yanıt Başlığı</label>
              <input type="text" value={formData.responsePrefix} onChange={e => setFormData({ ...formData, responsePrefix: e.target.value })}
                placeholder="Örn: TEMP:" className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono" />
            </div>
            <div className="flex flex-col gap-2 border p-3 rounded-xl border-gray-200">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={formData.autoMode} onChange={e => setFormData({ ...formData, autoMode: e.target.checked })}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500" />
                Otomatik Olarak Sorgula
              </label>
              {formData.autoMode && (
                <div className="flex items-center gap-2 mt-1">
                  <input type="number" min={1} max={60} value={formData.pollIntervalSec} onChange={e => setFormData({ ...formData, pollIntervalSec: parseInt(e.target.value) || 1 })}
                    className="w-20 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1.5 text-sm my-auto text-center font-mono" />
                  <span className="text-xs text-slate-500">Saniyede Bir (sn)</span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl border border-gray-300 text-slate-600 font-semibold text-sm hover:bg-gray-50">Vazgeç</button>
            <button onClick={handleSave} className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-bold text-sm hover:bg-cyan-700 transition-all shadow-sm">Kaydet</button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white rounded-xl font-bold text-sm shadow-sm transition-all min-h-[44px]">
            <PlusCircle className="w-4 h-4" /> Yeni Donanım Ekle
          </button>
        </div>
      )}

      {state.customDevices?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {state.customDevices.map(dev => (
            <div key={dev.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col min-h-[160px]">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-semibold text-slate-800">{dev.name}</h4>
                  <div className="flex gap-2 text-xs font-mono text-slate-400 mt-1">
                    <span className="px-1.5 bg-gray-50 border rounded-md">Pin: {dev.pin}</span>
                    <span className="px-1.5 bg-gray-50 border rounded-md">{dev.type === 'sensor' ? 'Sensör' : 'Aktüatör'}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(dev.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 flex flex-col justify-center mb-4 border border-gray-200 rounded-xl bg-gray-50 p-4 relative">
                <span className="text-[10px] absolute top-2 right-2 text-slate-400 font-bold tracking-wider">SON DEĞER</span>
                <span className={`text-2xl min-h-[32px] font-bold font-mono tracking-tight text-center ${dev.lastValue ? 'text-cyan-700' : 'text-slate-400'}`}>
                  {dev.lastValue || '—'}
                </span>
                {dev.lastUpdate && <span className="text-[10px] text-slate-400 text-center mt-1">Son Güncelleme: {dev.lastUpdate}</span>}
              </div>

              <div className="flex justify-between items-center bg-gray-50 p-2 rounded-xl border border-gray-200 mt-auto">
                <span className={`text-xs px-2 py-1 rounded-lg font-bold border ${dev.autoMode ? 'bg-cyan-50 text-cyan-600 border-cyan-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {dev.autoMode ? `AUTO (${dev.pollIntervalSec}s)` : 'MANUEL'}
                </span>
                {!dev.autoMode && dev.command && (
                  <button onClick={() => handleTrigger(dev.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white hover:bg-cyan-700 active:scale-95 transition-all text-xs font-bold rounded-lg shadow-sm">
                    <Send className="w-3.5 h-3.5" /> Sor
                  </button>
                )}
                {dev.type === 'actuator' && dev.autoMode === false && (
                  <button onClick={() => handleTrigger(dev.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white hover:bg-amber-600 active:scale-95 transition-all text-xs font-bold rounded-lg shadow-sm">
                    <Activity className="w-3.5 h-3.5" /> Tetikle
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

