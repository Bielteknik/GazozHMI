#!/bin/bash

# GazozHMI Raspberry Pi Kiosk Mode Setup Script
# Bu script Raspberry Pi OS (Desktop) üzerinde Chromium'u kiosk modunda başlatmak için kullanılır.

echo "[INFO] Kiosk modu yapılandırması başlatılıyor..."

# 1. Gerekli paketlerin yüklü olduğundan emin ol
sudo apt-get update
sudo apt-get install -y x11-xserver-utils xdotool unclutter sed

# 2. Autostart dizinini kontrol et
AUTOSTART_DIR="$HOME/.config/lxsession/LXDE-pi"
mkdir -p "$AUTOSTART_DIR"

# 3. Autostart dosyasını oluştur/güncelle
cat <<EOF > "$AUTOSTART_DIR/autostart"
@lxpanel --profile LXDE-pi
@pcmanfm --desktop --profile LXDE-pi
@xset s off
@xset -dpms
@xset s noblank
@unclutter -idle 0.1 -root
@chromium-browser --noerrdialogs --disable-infobars --kiosk http://localhost:3000
EOF

# 4. Ekran koruyucuyu devre dışı bırakmak için lightdm ayarları (Opsiyonel ama önerilir)
sudo sed -i 's/#xserver-command=X/xserver-command=X -s 0 -dpms/g' /etc/lightdm/lightdm.conf

echo "[SUCCESS] Kiosk modu ayarlandı. Sistemi yeniden başlattığınızda HMI tam sayfa açılacaktır."
echo "[TİP] Kiosk modundan çıkmak için Ctrl+W veya Alt+F4 kullanabilirsiniz."
