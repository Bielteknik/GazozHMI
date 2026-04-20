// ═══════════════════════════════════════════════════════
// CNC Motor Control - OPTICAL Switches (FIXED)
// ═══════════════════════════════════════════════════════

#define STEP_PIN 5
#define DIR_PIN 2
#define EN_PIN 8
#define X_MIN_PIN 12
#define X_MAX_PIN 11
#define Y_MIN_PIN 9
#define Y_MAX_PIN 10

int stepDelay = 800;
bool runContinuous = false;
bool direction = true;
unsigned long lastMoveTime = 0;
char currentAxis = 'X';

#define SWITCH_ACTIVE_HIGH true

// ═══════════════════════════════════════════════════════

bool readLimit(int pin) {
  int val = digitalRead(pin);
  return SWITCH_ACTIVE_HIGH ? (val == HIGH) : (val == LOW);
}

bool checkXLimit() {
  return readLimit(X_MIN_PIN) || readLimit(X_MAX_PIN);
}

bool checkYLimit() {
  return readLimit(Y_MIN_PIN) || readLimit(Y_MAX_PIN);
}

bool checkLimitEmergency() {
  return checkXLimit() || checkYLimit();
}

// ═══════════════════════════════════════════════════════

void enableDriver() {
  digitalWrite(EN_PIN, LOW);
}

void disableDriver() {
  digitalWrite(EN_PIN, HIGH);
}

// ═══════════════════════════════════════════════════════

void stepMotor(long steps, bool dir) {
  enableDriver();
  digitalWrite(DIR_PIN, dir);

  for(long i = 0; i < steps; i++) {
    if(checkLimitEmergency()) {
      Serial.println("LIMIT - STOP!");
      runContinuous = false;
      disableDriver();
      return;
    }
    
    digitalWrite(STEP_PIN, HIGH);
    delayMicroseconds(stepDelay);
    digitalWrite(STEP_PIN, LOW);
    delayMicroseconds(stepDelay);
  }
  lastMoveTime = millis();
}

// ═══════════════════════════════════════════════════════

void setup() {
  pinMode(STEP_PIN, OUTPUT);
  pinMode(DIR_PIN, OUTPUT);
  pinMode(EN_PIN, OUTPUT);
  
  pinMode(X_MIN_PIN, INPUT);
  pinMode(X_MAX_PIN, INPUT);
  pinMode(Y_MIN_PIN, INPUT);
  pinMode(Y_MAX_PIN, INPUT);
  
  disableDriver();
  Serial.begin(115200);
  
  Serial.println("=== CNC CONTROL - READY ===");
  Serial.println("X: D12(MIN) D13(MAX)");
  Serial.println("Y: D9(MIN)  D10(MAX)");
  Serial.println("");
  Serial.println("Commands:");
  Serial.println("  r       = Run continuous");
  Serial.println("  x       = Stop");
  Serial.println("  f100    = Forward 100 steps");
  Serial.println("  b100    = Backward 100 steps");
  Serial.println("  s500    = Set speed");
  Serial.println("  d1/d0   = Direction");
  Serial.println("  lim     = Check limits");
  Serial.println("  test    = Raw pin test");
  Serial.println("  axis=X  = Select X axis");
  Serial.println("  axis=Y  = Select Y axis");
  Serial.println("===========================");
}

// ═══════════════════════════════════════════════════════

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    Serial.print("CMD: ");
    Serial.println(cmd);
    
    // Eksen seçimi
    if (cmd == "axis=X" || cmd == "axis=x") {
      currentAxis = 'X';
      Serial.println("AXIS: X");
    }
    else if (cmd == "axis=Y" || cmd == "axis=y") {
      currentAxis = 'Y';
      Serial.println("AXIS: Y");
    }
    // İleri hareket
    else if (cmd.startsWith("f")) {
      long val = cmd.substring(1).toInt();
      Serial.print("Moving FWD: ");
      Serial.println(val);
      stepMotor(val, HIGH);
      Serial.println("DONE");
    }
    // Geri hareket
    else if (cmd.startsWith("b")) {
      long val = cmd.substring(1).toInt();
      Serial.print("Moving BACK: ");
      Serial.println(val);
      stepMotor(val, LOW);
      Serial.println("DONE");
    }
    // Hız ayarı
    else if (cmd.startsWith("s")) {
      stepDelay = cmd.substring(1).toInt();
      Serial.print("SPEED: ");
      Serial.println(stepDelay);
    }
    // Sürekli çalıştır
    else if (cmd == "r") {
      runContinuous = true;
      enableDriver();
      Serial.println("RUNNING...");
    }
    // Durdur
    else if (cmd == "x") {
      runContinuous = false;
      disableDriver();
      Serial.println("STOPPED");
    }
    // Yön ileri
    else if (cmd == "d1") {
      direction = true;
      Serial.println("DIR: FORWARD");
    }
    // Yön geri
    else if (cmd == "d0") {
      direction = false;
      Serial.println("DIR: BACKWARD");
    }
    // Limit durumu
    else if (cmd == "lim") {
      Serial.println("--- LIMIT STATUS ---");
      Serial.print("X-MIN(D12): ");
      Serial.println(readLimit(X_MIN_PIN) ? "TRIGGERED" : "OK");
      Serial.print("X-MAX(D13): ");
      Serial.println(readLimit(X_MAX_PIN) ? "TRIGGERED" : "OK");
      Serial.print("Y-MIN(D9):  ");
      Serial.println(readLimit(Y_MIN_PIN) ? "TRIGGERED" : "OK");
      Serial.print("Y-MAX(D10): ");
      Serial.println(readLimit(Y_MAX_PIN) ? "TRIGGERED" : "OK");
      Serial.println("-------------------");
    }
    // Raw pin test
    else if (cmd == "test") {
      Serial.println("=== RAW TEST ===");
      for(int i=0; i<5; i++){
        Serial.print("X-:"); Serial.print(digitalRead(X_MIN_PIN));
        Serial.print(" X+:"); Serial.print(digitalRead(X_MAX_PIN));
        Serial.print(" Y-:"); Serial.print(digitalRead(Y_MIN_PIN));
        Serial.print(" Y+:"); Serial.println(digitalRead(Y_MAX_PIN));
        delay(500);
      }
    }
    // Yardım
    else if (cmd == "?" || cmd == "help") {
      Serial.println("Commands: r, x, f100, b100, s500, d1, d0, lim, test, axis=X/Y");
    }
    // Bilinmeyen komut
    else if (cmd.length() > 0) {
      Serial.print("Unknown: ");
      Serial.println(cmd);
      Serial.println("Type 'help' for commands");
    }
  }

  // Sürekli çalışma modu
  if (runContinuous) {
    if(checkLimitEmergency()) {
      Serial.println("LIMIT - STOPPING!");
      runContinuous = false;
      disableDriver();
    } else {
      digitalWrite(DIR_PIN, direction);
      digitalWrite(STEP_PIN, HIGH);
      delayMicroseconds(stepDelay);
      digitalWrite(STEP_PIN, LOW);
      delayMicroseconds(stepDelay);
      lastMoveTime = millis();
    }
  }

  // Auto sleep
  if (!runContinuous && (millis() - lastMoveTime > 5000)) {
    disableDriver();
  }
}