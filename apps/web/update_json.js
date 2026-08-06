const fs = require('fs');

function updateJson(path, lang) {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));

  if (lang === 'ar') {
    data.Header = {
      "home": "الرئيسية",
      "pricing": "الأسعار",
      "solutions": "الحلول",
      "about": "من نحن",
      "contact": "تواصل معنا",
      "login": "تسجيل الدخول",
      "startFree": "ابدأ مجاناً"
    };

    data.Footer = {
      "desc": "المنصة التقنية الأولى لإدارة مشاريع المقاولات. نحمي أموالك ونوفر بياناتك بشفافية كاملة وقرارات ذكية.",
      "platform": "المنصة",
      "company": "الشركة",
      "solutions": "الحلول",
      "pricing": "الأسعار",
      "updates": "تحديثات المنصة",
      "about": "عن سوجين",
      "contact": "تواصل معنا",
      "terms": "الشروط والأحكام",
      "copyright": "© 2026 سوجين لتقنية المعلومات. جميع الحقوق محفوظة."
    };

    data.Landing = {
      "hero_new": {
        "tagline": "الجيل القادم من إدارة المقاولات",
        "title_1": "لا تدير مشاريعك بالحدس.",
        "title_highlight": "أدرها بالبيانات.",
        "desc": "سوجين يحوّل كل جنيه في مشروعك إلى رقم واضح. من العُهد إلى المستخلصات. من الحضور إلى الأرباح. بلا ورق، بلا تخمين.",
        "demo_btn": "احجز عرضاً توضيحياً",
        "explore_btn": "اكتشف المنصة"
      },
      "trust_bar": {
        "title": "موثوق من شركات رائدة في القطاع",
        "companies": ["المراسم", "بناء الخليج", "الفهد", "مجموعة البناء", "تطوير المشاريع"]
      },
      "why": {
        "tag": "المشكلة",
        "title_1": "مشروعك ينزف مالياً",
        "title_2": "وأنت آخر من يعلم.",
        "desc": "كل يوم بدون رقابة مالية دقيقة هو خسارة حقيقية لا تظهر في دفاترك إلا بعد فوات الأوان.",
        "cards": [
          { "t": "تسرّب مالي صامت", "d": "عُهد لا تُصفَّى لأشهر. فواتير بدون مستندات. أموال تتبخر بلا أثر أو إثبات." },
          { "t": "عمى إداري", "d": "لا تعرف كم صُرف اليوم. تعتمد على مكالمات ورسائل واتساب بدل البيانات. قرارات بالحدس." },
          { "t": "مستخلصات عشوائية", "d": "المقاول يطالب بمبالغ لا تطابق الإنجاز الفعلي على أرض الواقع. لا أحد يتحقق." }
        ]
      },
      "platform": {
        "tag": "المنصة",
        "title_1": "كل ما تحتاجه للتحكم.",
        "title_highlight": "في مكان واحد.",
        "cards": [
          { "t": "إدارة العُهد بذكاء", "d": "تصفية ذكية وسريعة. كل مبلغ مصروف مرتبط بفاتورته مباشرة. لا توجد عهدة مفتوحة بدون مستند واضح." },
          { "t": "مستخلصات دقيقة", "d": "إصدار تلقائي للمستخلصات بناءً على نسبة الإنجاز الفعلي. مراجعة واعتماد لحظي من الإدارة قبل الصرف." },
          { "t": "إدارة العمالة", "d": "تسجيل حضور وانصراف من الموقع. حساب التكلفة الفعلية للعامل مقابل الميزانية المخططة. شفافية تامة." },
          { "t": "تقارير تنفيذية", "d": "لوحة تحكم بصرية شاملة. اعرف الربح والخسارة وتدفقات النقدية لكل مشروع بنقرة زر واحدة." },
          { "t": "صلاحيات وحماية", "d": "نظام صلاحيات متقدم. كل موظف يرى ويتفاعل مع ما يخصه فقط. حماية بيانات على مستوى المؤسسات الكبرى." },
          { "t": "تنبيهات استباقية", "d": "إشعارات فورية للإدارة عند تجاوز نسب الميزانية المحددة أو عند تأخر جداول التسليم المعتمدة." }
        ]
      },
      "how": {
        "title_1": "أربع خطوات بسيطة",
        "title_2": "نحو",
        "title_highlight": "الشفافية المطلقة",
        "steps": [
          { "n": "01", "t": "طلب من الموقع", "d": "المهندس يرفع احتياجاته اليومية من التطبيق مباشرة وفي ثوانٍ." },
          { "n": "02", "t": "مراجعة واعتماد", "d": "النظام يطابق الطلب مع ميزانية المشروع تلقائياً لتسهيل الاعتماد." },
          { "n": "03", "t": "تصفية فورية", "d": "رفع الفواتير والإيصالات من الهاتف. تصفية العهدة تتم آلياً." },
          { "n": "04", "t": "تقارير حية", "d": "تقرير ربح وخسارة المشروع وكل تفاصيل التكاليف متاحة لحظياً." }
        ]
      },
      "stats": {
        "title": "ثقة مبنية على نتائج حقيقية",
        "cards": [
          { "l": "شركة مقاولات" },
          { "l": "مشروع نشط" },
          { "l": "رضا العملاء" },
          { "l": "توفير في التكاليف" }
        ]
      },
      "testimonial": {
        "quote": "قبل سوجين كنا نخسر ١٢٪ من أرباح كل مشروع بسبب الحسابات اليدوية. الآن كل قرش محسوب، مرئي، وتحت السيطرة التامة.",
        "author": "م. خالد العتيبي",
        "role": "المدير التنفيذي — مجموعة البناء المتقدم"
      },
      "cta": {
        "title_1": "جاهز لحماية أرباح",
        "title_highlight": "مشاريعك؟",
        "desc": "احجز عرضاً توضيحياً مجانياً وشاهد كيف يمكن لسوجين تغيير طريقة إدارتك للمشاريع خلال ١٥ دقيقة فقط.",
        "btn_1": "احجز عرضاً توضيحياً",
        "btn_2": "تحدث مع المبيعات"
      }
    };
  } else {
    data.Header = {
      "home": "Home",
      "pricing": "Pricing",
      "solutions": "Solutions",
      "about": "About Us",
      "contact": "Contact",
      "login": "Sign In",
      "startFree": "Start for Free"
    };

    data.Footer = {
      "desc": "The leading technical platform for construction project management. We protect your money and provide your data with complete transparency and smart decisions.",
      "platform": "Platform",
      "company": "Company",
      "solutions": "Solutions",
      "pricing": "Pricing",
      "updates": "Platform Updates",
      "about": "About Sojin",
      "contact": "Contact Us",
      "terms": "Terms & Conditions",
      "copyright": "© 2026 Sojin IT. All rights reserved."
    };

    data.Landing = {
      "hero_new": {
        "tagline": "The Next Generation of Construction Management",
        "title_1": "Don't manage projects by intuition.",
        "title_highlight": "Manage them with data.",
        "desc": "Sojin turns every dollar in your project into a clear number. From petty cash to invoices. From attendance to profits. No paper, no guesswork.",
        "demo_btn": "Book a Demo",
        "explore_btn": "Explore Platform"
      },
      "trust_bar": {
        "title": "TRUSTED BY LEADING INDUSTRY COMPANIES",
        "companies": ["Al Marasem", "Gulf Build", "Al Fahd", "Construction Group", "Projects Dev"]
      },
      "why": {
        "tag": "The Problem",
        "title_1": "Your project is bleeding financially",
        "title_2": "And you are the last to know.",
        "desc": "Every day without accurate financial control is a real loss that only appears in your books when it's too late.",
        "cards": [
          { "t": "Silent Financial Leakage", "d": "Petty cash uncleared for months. Invoices without documents. Money evaporates with no trace." },
          { "t": "Management Blindness", "d": "You don't know what was spent today. Relying on WhatsApp calls instead of data. Decisions by intuition." },
          { "t": "Chaotic Invoicing", "d": "Contractors demand amounts that don't match actual progress on the ground. No one verifies." }
        ]
      },
      "platform": {
        "tag": "The Platform",
        "title_1": "Everything you need to control.",
        "title_highlight": "In one place.",
        "cards": [
          { "t": "Smart Petty Cash", "d": "Fast and smart clearance. Every amount spent is linked to its invoice. No open cash without a document." },
          { "t": "Accurate Invoicing", "d": "Automatic invoice generation based on actual progress. Instant management review before payment." },
          { "t": "Labor Management", "d": "Site attendance tracking. Calculate actual labor cost vs planned budget. Complete transparency." },
          { "t": "Executive Reports", "d": "Comprehensive visual dashboard. Know profit, loss, and cash flows for each project with one click." },
          { "t": "Permissions & Security", "d": "Advanced permissions. Each employee interacts only with what concerns them. Enterprise-grade security." },
          { "t": "Proactive Alerts", "d": "Instant notifications to management when budgets are exceeded or delivery schedules are delayed." }
        ]
      },
      "how": {
        "title_1": "Four simple steps",
        "title_2": "Towards",
        "title_highlight": "Absolute Transparency",
        "steps": [
          { "n": "01", "t": "Request from Site", "d": "Engineer submits daily needs directly from the app in seconds." },
          { "n": "02", "t": "Review & Approve", "d": "System matches request with project budget automatically for easy approval." },
          { "n": "03", "t": "Instant Clearance", "d": "Upload invoices and receipts from mobile. Cash clearance is done automatically." },
          { "n": "04", "t": "Live Reports", "d": "Project P&L and all cost details are available instantly." }
        ]
      },
      "stats": {
        "title": "Trust built on real results",
        "cards": [
          { "l": "Construction Company" },
          { "l": "Active Project" },
          { "l": "Customer Satisfaction" },
          { "l": "Cost Savings" }
        ]
      },
      "testimonial": {
        "quote": "Before Sojin, we were losing 12% of profits per project due to manual calculations. Now every penny is accounted for, visible, and under control.",
        "author": "Eng. Khalid Al-Otaibi",
        "role": "CEO — Advanced Construction Group"
      },
      "cta": {
        "title_1": "Ready to protect your",
        "title_highlight": "projects' profits?",
        "desc": "Book a free demo and see how Sojin can change the way you manage projects in just 15 minutes.",
        "btn_1": "Book a Demo",
        "btn_2": "Talk to Sales"
      }
    };
  }

  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

updateJson('d:/tampalets/saas-one/apps/web/messages/ar.json', 'ar');
updateJson('d:/tampalets/saas-one/apps/web/messages/en.json', 'en');
console.log('Updated JSON files.');
