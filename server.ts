import express from 'express';
import { createServer as createViteServer } from 'vite';
import TelegramBot from 'node-telegram-bot-api';
import path from 'path';

// Load environment variables if not in production
if (process.env.NODE_ENV !== 'production') {
  import('dotenv').then(dotenv => dotenv.config());
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminChatId = process.env.TELEGRAM_CHAT_ID;

let bot: TelegramBot | null = null;
let totalClicks = 0;

// Application State
const appConfig = {
  smsNumber: '222' // Default SMS number
};

if (token) {
  try {
    bot = new TelegramBot(token, { polling: true });
    
    // Command to change SMS number
    bot.onText(/\/setsms (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      if (adminChatId && chatId.toString() !== adminChatId) {
        bot?.sendMessage(chatId, 'عذراً، ليس لديك صلاحية لتغيير الإعدادات.');
        return;
      }
      if (match) {
        appConfig.smsNumber = match[1];
        bot?.sendMessage(chatId, `✅ تم تغيير رقم الـ SMS بنجاح إلى: ${appConfig.smsNumber}`);
      }
    });

    // Command to get stats
    bot.onText(/\/stats/, (msg) => {
      const chatId = msg.chat.id;
      if (adminChatId && chatId.toString() !== adminChatId) return;
      bot?.sendMessage(chatId, `📊 إحصائيات التفعيل:\n\nإجمالي عدد النقرات على "تفعيل الآن": ${totalClicks}`);
    });

    // Help command
    bot.onText(/\/start|\/help/, (msg) => {
      const chatId = msg.chat.id;
      const helpText = `
مرحباً بك في لوحة تحكم باقات الأعمال 📱

الأوامر المتاحة:
/setsms [number] - لتغيير رقم الـ SMS الذي يتم إرسال كود التفعيل إليه.
/stats - لعرض إجمالي عدد النقرات على زر التفعيل.
      `;
      bot?.sendMessage(chatId, helpText);
    });

    console.log('Telegram Bot initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Telegram Bot:', error);
  }
} else {
  console.warn('TELEGRAM_BOT_TOKEN is not set. Telegram features will be disabled.');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to get current configuration
  app.get('/api/config', (req, res) => {
    res.json(appConfig);
  });

  // API to track clicks
  app.post('/api/track', async (req, res) => {
    const { pkgId, pkgTitle, device } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
    
    totalClicks++;

    let location = 'غير معروف';
    try {
      // Fetch location based on IP
      const geoRes = await fetch(`http://ip-api.com/json/${ip}`);
      const geoData = await geoRes.json();
      if (geoData.status === 'success') {
        location = `${geoData.city}, ${geoData.country}`;
      }
    } catch (e) {
      console.error('Failed to fetch geolocation:', e);
    }

    if (bot && adminChatId) {
      const message = `
🚨 **نقرة جديدة على تفعيل الباقة!** 🚨

📦 الباقة: ${pkgTitle}
📱 الجهاز: ${device}
🌐 الآيبي: ${ip}
📍 الموقع: ${location}

📈 إجمالي النقرات حتى الآن: ${totalClicks}
`;
      bot.sendMessage(adminChatId, message, { parse_mode: 'Markdown' }).catch(err => console.error('Telegram send error:', err));
    }

    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
