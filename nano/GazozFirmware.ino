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
  
  // Tüm olası pinleri başlangıçta INPUT yapıp güvene alalım
  for (int i = 2; i <= 13; i++) pinMode(i, INPUT_PULLUP);
  
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
          
          // Valfi aç (Röle ters mantık çalışıyorsa LOW yapılacak, burada Düz mantık: HIGH açar kabul edildi)
          digitalWrite(pin, HIGH);
          
          activeValveCount++;
        }
        startIdx = commaIdx + 1;
      }
      Serial.println("OK:FILL_STARTED");
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
