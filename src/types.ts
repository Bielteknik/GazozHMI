export interface SystemState {
  systemRunning: boolean;
  emergencyStop: boolean;
  hasError?: boolean;
  valves: boolean[];
  motors: {
    id: number;
    name: string;
    running: boolean;
    speed: number;
    direction: 'forward' | 'reverse';
    runningTime: number;
    steps?: number;
  }[];
  sensors: {
    id: number;
    name: string;
    count: number;
    active?: boolean;
    blocked?: boolean;
  }[];
  limitSwitches: {
    id: string;
    name: string;
    active: boolean;
    type: 'entry' | 'exit';
    position: 'cw' | 'ccw';
  }[];
  locks: { entry: boolean; exit: boolean };
  config: {
    fillWaitTime: number;
    syrupVolume: number;
    valveFillTimes: number[];
    targetBottles: number;
  };
  process: {
    state: 'WAITING_BOTTLES' | 'PRE_FILL_WAIT' | 'FILLING' | 'POST_FILL_WAIT' | 'EXITING_BOTTLES';
    bottlesInArea: number;
    timer: number;
    currentCycleId?: number;
  };
  hardware: {
    rpi: { connected: boolean; port: string; status: string };
    nano: { connected: boolean; port: string; baudRate: number; status: string; simulated: boolean };
  };
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
