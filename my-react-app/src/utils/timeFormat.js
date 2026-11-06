/**
 * AQUASENTRY - TIME & DATE FORMATTING UTILITIES (WIB / UTC+7)
 * Memastikan semua tampilan waktu dan tanggal di aplikasi web terformat
 * seragam dalam Waktu Indonesia Barat (WIB, Asia/Jakarta, UTC+7).
 */

const TIMEZONE = 'Asia/Jakarta';

/**
 * Format timestamp (number ms, Date, atau string) menjadi "HH.mm.ss" WIB.
 * Contoh: 1793977426013 -> "22.03.46"
 */
export function formatTimeWithSeconds(timestamp) {
    if (!timestamp) return 'Belum ada data';
    const date = toValidDate(timestamp);
    if (!date) return String(timestamp);

    try {
        return new Intl.DateTimeFormat('id-ID', {
            timeZone: TIMEZONE,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(date);
    } catch {
        return date.toLocaleTimeString('id-ID');
    }
}

/**
 * Format timestamp menjadi "HH.mm" WIB.
 * Contoh: 1793977426013 -> "22.03"
 */
export function formatTime(timestamp) {
    if (!timestamp) return '--:--';
    const date = toValidDate(timestamp);
    if (!date) return String(timestamp);

    try {
        return new Intl.DateTimeFormat('id-ID', {
            timeZone: TIMEZONE,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(date);
    } catch {
        return date.toLocaleTimeString('id-ID');
    }
}

/**
 * Format tanggal panjang lengkap: "Jumat, 6 November 2026, 22.03 WIB"
 */
export function formatDateTimeFull(timestamp) {
    if (!timestamp) return 'Belum ada data';
    const date = toValidDate(timestamp);
    if (!date) return String(timestamp);

    try {
        const dateStr = new Intl.DateTimeFormat('id-ID', {
            timeZone: TIMEZONE,
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date);

        const timeStr = formatTimeWithSeconds(date);
        return `${dateStr}, ${timeStr} WIB`;
    } catch {
        return date.toLocaleString('id-ID');
    }
}

/**
 * Format tanggal singkat: "6 Nov" atau "6 Nov 2026"
 */
export function formatDateShort(timestamp) {
    if (!timestamp) return '';
    const date = toValidDate(timestamp);
    if (!date) return String(timestamp);

    try {
        return new Intl.DateTimeFormat('id-ID', {
            timeZone: TIMEZONE,
            day: 'numeric',
            month: 'short'
        }).format(date);
    } catch {
        return date.toLocaleDateString('id-ID');
    }
}

/**
 * Memperbaiki string timestamp ESP32 yang terlanjur terkirim dalam UTC (selisih 7 jam di belakang).
 * Contoh: "06 Nov 2026, 15:03:43 WIB" -> "06 Nov 2026, 22:03:43 WIB"
 */
export function formatEspTimestampDisplay(rawString) {
    if (!rawString) return 'Baru saja';
    if (typeof rawString === 'number') {
        return formatDateTimeFull(rawString);
    }

    const str = String(rawString).trim();

    // Deteksi pola "DD Mmm YYYY, HH:MM:SS" atau sejenisnya
    const match = str.match(/(\d{1,2}\s+[A-Za-z]{3}\s+\d{4}),\s*(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
        const [_, datePart, hourStr, minStr, secStr] = match;
        let hour = parseInt(hourStr, 10);

        // Jika jam berada di rentang 00-16 (UTC jam sore/siang padahal malam di WIB),
        // otomatis tambahkan selisih +7 jam (akali agar tampil malam sesuai jam sekarang)
        if (hour <= 16 && str.includes('WIB')) {
            hour = (hour + 7) % 24;
            const newHourStr = String(hour).padStart(2, '0');
            return `${datePart}, ${newHourStr}:${minStr}:${secStr} WIB`;
        }
        return str;
    }

    // Jika string berupa ISO date atau unix epoch
    const num = Number(str);
    if (!isNaN(num) && num > 1000000000) {
        return formatDateTimeFull(num);
    }

    return str;
}

/**
 * Ekstraksi ringkas jam:menit dari timestamp string untuk penamaan sampel air
 * Contoh: "06 Nov 2026, 15:03:43 WIB" -> "22:03"
 */
export function extractBriefTime(rawString) {
    if (!rawString) return '';
    const adjusted = formatEspTimestampDisplay(rawString);
    const match = adjusted.match(/(\d{2}):(\d{2})/);
    if (match) {
        return `${match[1]}:${match[2]}`;
    }
    return '';
}

function toValidDate(val) {
    if (val instanceof Date && !isNaN(val)) return val;
    if (typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d) ? null : d;
    }
    if (typeof val === 'string') {
        const num = Number(val);
        if (!isNaN(num)) {
            const d = new Date(num);
            if (!isNaN(d)) return d;
        }
        const d = new Date(val);
        return isNaN(d) ? null : d;
    }
    return null;
}
