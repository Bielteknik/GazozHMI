/*
 * GazozHMI Fully Dynamic Slave Firmware (Arduino Nano)
 * 
 * Bu yazılım hiçbir sabit PIN içermez. Raspi'den gelecek JSON/String 
 * komutlar ile çalışma anında pinleri tanımlanır.
 * 
 * Protokol:
 * RPI -> NANO: PINCFG:valve:D5  (Cihaz tipini ve pinini ayarlar)
 * RPI -> NANO: PINCFG:motor:D6
 * RPI -> NANO: FILL_START:D5=3000,D6=4500 (D5 pinini 3sn, D6 pinini 4.5sn aç ve otonom kapat)
 * RPI -> NANO: OPEN:D8 (D8'e High yolla, motor/tweak)
 * RPI -> NANO: CLOSE:D8 (D8'e Low yolla)
 * NANO -> RPI: FILL_DONE (Tüm dolumlar bitince)
 */

#define MAX_VALVES 20

// CNC Shield v4 Pin Tanımları
#define EN_PIN 8
#define X_STEP 5
#define X_DIR  2
#define Y_STEP 3
#define Y_DIR  6
#define Z_STEP 4
#define Z_DIR  7

struct ValveTimer {
  int pin;
  unsigned long duration;
  unsigned long startTime;
  bool active;
};

ValveTimer activeValves[MAX_VALVES];
int activeValveCount = 0;
bool isFilling = false;

// String parçalama yardımcı fonksiyonu
int parsePin(String pinStr) {
  pinStr.toUpperCase();
  if(pinStr.startsWith("A")) {
    return A0 + pinStr.substring(1).toInt();
  } else if (pinStr.startsWith("D")) {
    return pinStr.substring(1).toInt();
  }
  return pinStr.toInt();
}

void setup() {
  Serial.begin(115200);
  while (!Serial) {;}
  
  // Standart pinleri başlangıçta INPUT yapıp güvene alalım
  for (int i = 2; i <= 13; i++) pinMode(i, INPUT_PULLUP);
  
  // CNC Shield Pinlerini yapılandır
  pinMode(EN_PIN, OUTPUT);
  digitalWrite(EN_PIN, HIGH); // Başlangıçta pasif (Sleep)
  
  pinMode(X_STEP, OUTPUT); pinMode(X_DIR, OUTPUT);
  pinMode(Y_STEP, OUTPUT); pinMode(Y_DIR, OUTPUT);
  pinMode(Z_STEP, OUTPUT); pinMode(Z_DIR, OUTPUT);
  
  Serial.println("READY");
}

void loop() {
  // --- Seri Port Komut Okuma ---
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.length() == 0) return;
    
    if (cmd.startsWith("PINCFG:")) {
      // Örn: PINCFG:valve:D5
      int firstColon = cmd.indexOf(':');
      int secondColon = cmd.indexOf(':', firstColon + 1);
      if(firstColon > 0 && secondColon > 0) {
        String type = cmd.substring(firstColon + 1, secondColon);
        String pinStr = cmd.substring(secondColon + 1);
        int pin = parsePin(pinStr);
        pinMode(pin, OUTPUT);
        digitalWrite(pin, LOW);
        Serial.println("OK:CFG:" + pinStr);
      }
    } 
    else if (cmd.startsWith("FILL_START:")) {
      // Örn: FILL_START:D5=3000,D6=4500
      String payload = cmd.substring(11);
      activeValveCount = 0;
      isFilling = true;
      
      int startIdx = 0;
      while(startIdx < payload.length() && activeValveCount < MAX_VALVES) {
        int commaIdx = payload.indexOf(',', startIdx);
        if (commaIdx == -1) commaIdx = payload.length();
        
        String pair = payload.substring(startIdx, commaIdx);
        int eqIdx = pair.indexOf('=');
        if(eqIdx > 0) {
          String pinStr = pair.substring(0, eqIdx);
          unsigned long dur = pair.substring(eqIdx + 1).toInt();
          int pin = parsePin(pinStr);
          
          activeValves[activeValveCount].pin = pin;
          activeValves[activeValveCount].duration = dur;
          activeValves[activeValveCount].startTime = millis();
          activeValves[activeValveCount].active = true;
          
          // Valfi aç
          digitalWrite(pin, HIGH);
          
          activeValveCount++;
        }
        startIdx = commaIdx + 1;
      }
      Serial.println("OK:FILL_STARTED");
    }
    else if (cmd.startsWith("MV:")) {
      // Örn: MV:X:F:600:800 (Eksen:Yön:Adım:GecikmeUS)
      int c1 = cmd.indexOf(':');
      int c2 = cmd.indexOf(':', c1 + 1);
      int c3 = cmd.indexOf(':', c2 + 1);
      int c4 = cmd.indexOf(':', c3 + 1);
      
      if (c1 > 0 && c2 > 0 && c3 > 0 && c4 > 0) {
        char axis = cmd.substring(c1 + 1, c2).charAt(0);
        char dirChar = cmd.substring(c2 + 1, c3).charAt(0);
        long steps = cmd.substring(c3 + 1, c4).toInt();
        int delayUs = cmd.substring(c4 + 1).toInt();
        
        int sPin = -1, dPin = -1;
        if (axis == 'X') { sPin = X_STEP; dPin = X_DIR; }
        else if (axis == 'Y') { sPin = Y_STEP; dPin = Y_DIR; }
        else if (axis == 'Z') { sPin = Z_STEP; dPin = Z_DIR; }
        
        if (sPin != -1) {
          digitalWrite(EN_PIN, LOW); // Sürücüyü aktif et
          digitalWrite(dPin, (dirChar == 'F' || dirChar == 'f') ? HIGH : LOW);
          
          for (long i = 0; i < steps; i++) {
            digitalWrite(sPin, HIGH);
            delayMicroseconds(delayUs);
            digitalWrite(sPin, LOW);
            delayMicroseconds(delayUs);
          }
          
          // Hareket bitti, sürücüyü uyut (Isınmayı engeller)
          digitalWrite(EN_PIN, HIGH);
          Serial.println("OK:MOVE_DONE");
        } else {
          Serial.println("ERR:INVALID_AXIS");
        }
      }
    }
    else if (cmd.startsWith("OPEN:")) {
      int pin = parsePin(cmd.substring(5));
      digitalWrite(pin, HIGH);
      Serial.println("OK:OPEN:" + String(pin));
    }
    else if (cmd.startsWith("CLOSE:")) {
      int pin = parsePin(cmd.substring(6));
      digitalWrite(pin, LOW);
      Serial.println("OK:CLOSE:" + String(pin));
    }
    else if (cmd == "ESTOP") {
      // Tüm olası çıkışları sıfırla
      for(int i=2; i<=13; i++) digitalWrite(i, LOW);
      digitalWrite(EN_PIN, HIGH); // Step motorları durdur/kapat
      isFilling = false;
      activeValveCount = 0;
      Serial.println("OK:ESTOP_ACTIVATED");
    }
    else if (cmd == "STATUS") {
      Serial.println(isFilling ? "STATUS:FILLING" : "STATUS:IDLE");
    }
    else if (cmd == "PING") {
      Serial.println("PONG");
    }
  }
  
  // --- Otonom Non-Blocking Dolum Yönetimi ---
  if (isFilling) {
    bool allDone = true;
    unsigned long currentMillis = millis();
    
    for (int i = 0; i < activeValveCount; i++) {
      if (activeValves[i].active) {
        if (currentMillis - activeValves[i].startTime >= activeValves[i].duration) {
          // Süresi doldu, kapat
          digitalWrite(activeValves[i].pin, LOW);
          activeValves[i].active = false;
        } else {
          allDone = false; // Hâlâ açık olan valf var
        }
      }
    }
    
    if (allDone && activeValveCount > 0) {
      isFilling = false;
      activeValveCount = 0;
      Serial.println("FILL_DONE");
    }
  }
}
