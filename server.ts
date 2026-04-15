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
type PendingAction = 'add_number';
const pendingActions = new Map<number, PendingAction>();

// Application State
const appConfig = {
  smsNumber: '7700000000' // Number injected into SMS body
};
const smsNumbers: string[] = [appConfig.smsNumber];

function normalizeSmsNumber(raw: string): string {
  return raw.trim().replace(/\s+/g, '');
}

function setActiveSmsNumber(nextNumber: string): boolean {
  const normalized = normalizeSmsNumber(nextNumber);
  if (!normalized) return false;
  appConfig.smsNumber = normalized;
  if (!smsNumbers.includes(normalized)) {
    smsNumbers.push(normalized);
  }
  return true;
}

function formatNumbersList(): string {
  return smsNumbers
    .map((num, index) => `${index + 1}. ${num}${num === appConfig.smsNumber ? ' ✅ (النشط)' : ''}`)
    .join('\n');
}

function isAdmin(chatId: number): boolean {
  return !adminChatId || chatId.toString() === adminChatId;
}

function getMainMenuKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: '📱 عرض الأرقام' }, { text: '🔁 تبديل الرقم' }],
      [{ text: '➕ إضافة رقم' }, { text: '🗑️ حذف رقم' }],
      [{ text: '📊 الإحصائيات' }, { text: '❓ مساعدة' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function getNumbersInlineKeyboard(mode: 'set' | 'remove'): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: smsNumbers.map((num, index) => {
      const label = `${index + 1}) ${num}${num === appConfig.smsNumber ? ' ✅' : ''}`;
      const callback_data = `${mode}:${num}`;
      return [{ text: label, callback_data }];
    }),
  };
}

if (token) {
  try {
    bot = new TelegramBot(token, { polling: true });
    
    // Command to change managed number directly (backward compatible)
    bot.onText(/\/setsms (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      if (!isAdmin(chatId)) {
        bot?.sendMessage(chatId, 'عذراً، ليس لديك صلاحية لتغيير الإعدادات.');
        return;
      }
      if (match) {
        const ok = setActiveSmsNumber(match[1]);
        if (!ok) {
          bot?.sendMessage(chatId, '⚠️ الرجاء إدخال رقم صالح.');
          return;
        }
        bot?.sendMessage(chatId, `✅ تم ضبط الرقم النشط (داخل نص الرسالة) إلى: ${appConfig.smsNumber}`);
      }
    });

    // Add a number to the pool
    bot.onText(/\/addsms (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      if (!isAdmin(chatId)) {
        bot?.sendMessage(chatId, 'عذراً، ليس لديك صلاحية لتغيير الإعدادات.');
        return;
      }
      if (!match) return;
      const candidate = normalizeSmsNumber(match[1]);
      if (!candidate) {
        bot?.sendMessage(chatId, '⚠️ الرجاء إدخال رقم صالح.');
        return;
      }
      if (smsNumbers.includes(candidate)) {
        bot?.sendMessage(chatId, `ℹ️ الرقم موجود مسبقاً: ${candidate}`);
        return;
      }
      smsNumbers.push(candidate);
      bot?.sendMessage(chatId, `✅ تمت إضافة الرقم: ${candidate}\n\n📋 القائمة الحالية:\n${formatNumbersList()}`);
    });

    // List all configured numbers
    bot.onText(/\/listsms/, (msg) => {
      const chatId = msg.chat.id;
      if (!isAdmin(chatId)) return;
      bot?.sendMessage(chatId, `📱 قائمة الأرقام المُدارة (داخل نص الرسالة):\n${formatNumbersList()}`);
    });

    // Set active number by index or number
    bot.onText(/\/setnumber (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      if (!isAdmin(chatId)) {
        bot?.sendMessage(chatId, 'عذراً، ليس لديك صلاحية لتغيير الإعدادات.');
        return;
      }
      if (!match) return;

      const value = normalizeSmsNumber(match[1]);
      const asIndex = Number(value);
      let selected = value;

      if (/^\d+$/.test(value) && Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= smsNumbers.length) {
        selected = smsNumbers[asIndex - 1];
      } else if (!smsNumbers.includes(value)) {
        bot?.sendMessage(
          chatId,
          `⚠️ الرقم غير موجود بالقائمة. أضفه أولاً باستخدام /addsms [number]\n\n📋 القائمة الحالية:\n${formatNumbersList()}`
        );
        return;
      }

      appConfig.smsNumber = selected;
      bot?.sendMessage(chatId, `✅ تم تفعيل الرقم: ${selected}\n\n📋 القائمة الحالية:\n${formatNumbersList()}`);
    });

    // Remove number from the pool by index or number
    bot.onText(/\/removesms (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      if (!isAdmin(chatId)) {
        bot?.sendMessage(chatId, 'عذراً، ليس لديك صلاحية لتغيير الإعدادات.');
        return;
      }
      if (!match) return;

      const value = normalizeSmsNumber(match[1]);
      const asIndex = Number(value);
      let target = value;

      if (/^\d+$/.test(value) && Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= smsNumbers.length) {
        target = smsNumbers[asIndex - 1];
      }

      const idx = smsNumbers.indexOf(target);
      if (idx === -1) {
        bot?.sendMessage(chatId, '⚠️ الرقم غير موجود.');
        return;
      }
      if (smsNumbers.length === 1) {
        bot?.sendMessage(chatId, '⚠️ لا يمكن حذف آخر رقم. يجب أن يبقى رقم واحد على الأقل.');
        return;
      }

      const wasActive = appConfig.smsNumber === target;
      smsNumbers.splice(idx, 1);
      if (wasActive) {
        appConfig.smsNumber = smsNumbers[0];
      }

      bot?.sendMessage(
        chatId,
        `🗑️ تم حذف الرقم: ${target}${wasActive ? `\n✅ تم تحويل الرقم النشط إلى: ${appConfig.smsNumber}` : ''}\n\n📋 القائمة الحالية:\n${formatNumbersList()}`
      );
    });

    // Command to get stats
    bot.onText(/\/stats/, (msg) => {
      const chatId = msg.chat.id;
      if (!isAdmin(chatId)) return;
      bot?.sendMessage(chatId, `📊 إحصائيات التفعيل:\n\nإجمالي عدد النقرات على "تفعيل الآن": ${totalClicks}`);
    });

    // Help command
    bot.onText(/\/start|\/help/, (msg) => {
      const chatId = msg.chat.id;
      if (!isAdmin(chatId)) {
        bot?.sendMessage(chatId, 'عذراً، ليس لديك صلاحية للوصول إلى لوحة التحكم.');
        return;
      }
      const helpText = `
مرحباً بك في لوحة تحكم باقات الأعمال 📱

الأوامر المتاحة:
/setsms [number] - تعيين الرقم النشط داخل نص رسالة SMS.
/addsms [number] - إضافة رقم جديد إلى قائمة الأرقام.
/listsms - عرض جميع الأرقام مع تحديد الرقم النشط.
/setnumber [index|number] - التبديل بين الأرقام (مثال: /setnumber 2).
/removesms [index|number] - حذف رقم من القائمة.
/stats - لعرض إجمالي عدد النقرات على زر التفعيل.

صيغة الإرسال الحالية في الموقع:
إلى: 222 (ثابت)
نص الرسالة: سعر_العرض,الرقم_النشط

واجهة الأزرار:
- 📱 عرض الأرقام
- ➕ إضافة رقم
- 🔁 تبديل الرقم
- 🗑️ حذف رقم
      `;
      bot?.sendMessage(chatId, helpText, { reply_markup: getMainMenuKeyboard() });
    });

    // Button-based easy menu
    bot.on('message', (msg) => {
      const chatId = msg.chat.id;
      if (!isAdmin(chatId)) return;
      if (!msg.text) return;
      if (msg.text.startsWith('/')) return;

      const pendingAction = pendingActions.get(chatId);
      if (pendingAction === 'add_number') {
        const candidate = normalizeSmsNumber(msg.text);
        if (!candidate) {
          bot?.sendMessage(chatId, '⚠️ الرقم غير صالح. أرسل رقم صحيح بدون فراغات.');
          return;
        }
        if (smsNumbers.includes(candidate)) {
          bot?.sendMessage(chatId, `ℹ️ الرقم موجود مسبقاً: ${candidate}`);
          pendingActions.delete(chatId);
          return;
        }
        smsNumbers.push(candidate);
        pendingActions.delete(chatId);
        bot?.sendMessage(chatId, `✅ تمت إضافة الرقم: ${candidate}\n\n📋 القائمة الحالية:\n${formatNumbersList()}`);
        return;
      }

      if (msg.text === '📱 عرض الأرقام') {
        bot?.sendMessage(chatId, `📱 قائمة أرقام التفعيل:\n${formatNumbersList()}`, {
          reply_markup: getMainMenuKeyboard(),
        });
        return;
      }

      if (msg.text === '➕ إضافة رقم') {
        pendingActions.set(chatId, 'add_number');
        bot?.sendMessage(chatId, '✍️ أرسل الآن الرقم الجديد الذي تريد إضافته:', {
          reply_markup: getMainMenuKeyboard(),
        });
        return;
      }

      if (msg.text === '🔁 تبديل الرقم') {
        bot?.sendMessage(chatId, `اختر الرقم الذي تريد تفعيله:\n\n${formatNumbersList()}`, {
          reply_markup: getNumbersInlineKeyboard('set'),
        });
        return;
      }

      if (msg.text === '🗑️ حذف رقم') {
        bot?.sendMessage(chatId, `اختر الرقم الذي تريد حذفه:\n\n${formatNumbersList()}`, {
          reply_markup: getNumbersInlineKeyboard('remove'),
        });
        return;
      }

      if (msg.text === '📊 الإحصائيات') {
        bot?.sendMessage(chatId, `📊 إحصائيات التفعيل:\n\nإجمالي عدد النقرات على "تفعيل الآن": ${totalClicks}`, {
          reply_markup: getMainMenuKeyboard(),
        });
        return;
      }

      if (msg.text === '❓ مساعدة') {
        bot?.sendMessage(chatId, 'استخدم الأزرار أدناه لإدارة الأرقام بسهولة، أو اكتب /help لعرض الأوامر.', {
          reply_markup: getMainMenuKeyboard(),
        });
      }
    });

    bot.on('callback_query', (query) => {
      const message = query.message;
      const chatId = message?.chat.id;
      const data = query.data;
      if (!message || !chatId || !data) return;
      if (!isAdmin(chatId)) return;

      const [action, value] = data.split(':');
      if (!action || !value) return;

      if (action === 'set') {
        if (!smsNumbers.includes(value)) {
          bot?.answerCallbackQuery(query.id, { text: 'الرقم لم يعد موجوداً.' });
          return;
        }
        appConfig.smsNumber = value;
        bot?.answerCallbackQuery(query.id, { text: `تم تفعيل ${value}` });
        bot?.sendMessage(chatId, `✅ تم تفعيل الرقم: ${value}\n\n📋 القائمة الحالية:\n${formatNumbersList()}`, {
          reply_markup: getMainMenuKeyboard(),
        });
        return;
      }

      if (action === 'remove') {
        const idx = smsNumbers.indexOf(value);
        if (idx === -1) {
          bot?.answerCallbackQuery(query.id, { text: 'الرقم غير موجود.' });
          return;
        }
        if (smsNumbers.length === 1) {
          bot?.answerCallbackQuery(query.id, { text: 'لا يمكن حذف آخر رقم.' });
          return;
        }

        const wasActive = appConfig.smsNumber === value;
        smsNumbers.splice(idx, 1);
        if (wasActive) appConfig.smsNumber = smsNumbers[0];

        bot?.answerCallbackQuery(query.id, { text: `تم حذف ${value}` });
        bot?.sendMessage(
          chatId,
          `🗑️ تم حذف الرقم: ${value}${wasActive ? `\n✅ تم تحويل الرقم النشط إلى: ${appConfig.smsNumber}` : ''}\n\n📋 القائمة الحالية:\n${formatNumbersList()}`,
          { reply_markup: getMainMenuKeyboard() }
        );
      }
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
