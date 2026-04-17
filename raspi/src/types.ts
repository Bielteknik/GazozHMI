export interface SystemState {
  systemRunning: boolean;
  emergencyStop: boolean;
  hasError?: boolean;
  
  process: {
    state: 'IDLE' | 'WAITING_ENTRY' | 'FILLING' | 'WAITING_EXIT' | 'WASHING';
    bottlesInArea: number;
    targetBottles: number;
    currentCycleId?: number;
  };
  
  hardware: {
    rpi: { connected: boolean; status: string };
    nano: { connected: boolean; port: string; baudRate: number; status: string };
  };
  
  config: {
    fillWaitTime: number;
    sensorTimeout: number;
    dailyQuota: number;
  };
  
  devices: Device[]; // 100% dinamik donanımlar
}

export type ConnectionTarget = 'raspi' | 'nano';
export type DeviceType = 'valve' | 'motor' | 'laser_sensor' | 'limit_switch' | 'generic';
export type SystemRole = 
  | 'none'
  | 'entry_laser'
  | 'exit_laser'
  | 'entry_lock'
  | 'exit_lock'
  | 'valve_1' | 'valve_2' | 'valve_3' | 'valve_4' | 'valve_5' 
  | 'valve_6' | 'valve_7' | 'valve_8' | 'valve_9' | 'valve_10';

export interface Device {
  id: string;              // UUID
  name: string;            // Kullanıcı dostu isim
  type: DeviceType;        // Donanımın fiziksel/mantıksal tipi
  role: SystemRole;        // Sistem içerisindeki görevi
  target: ConnectionTarget;// Hangi karta bağlı?
  pin: string;             // Fiziksel bağlandı pini (Örn: GPIO4 veya D8)
  fillDurationMs?: number; // Sadece valfler için (ms cinsinden dolum süresi)
  
  // -- Gerçek zamanlı (Volatile) State Durumları --
  active: boolean;         // Şu an tetiklenmiş (Açık) durumda mı?
  count?: number;          // Sensörler için sayıcı
  lastUpdate: string | null;
}

export interface ProductionCycle {
  id: number;
  started_at: string;
  completed_at?: string;
  bottles_in: number;
  bottles_out: number;
  status: 'running' | 'completed' | 'interrupted' | 'estop';
}

export interface Alarm {
  id: number;
  created_at: string;
  type: 'ESTOP' | 'SENSOR_FAULT' | 'MOTOR_FAULT' | 'INFO';
  message: string;
  resolved_at?: string;
}
