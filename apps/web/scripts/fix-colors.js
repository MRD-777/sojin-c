const fs = require('fs');
const files = [
  'D:/tampalets/saas-one/apps/web/src/app/[locale]/about/page.tsx',
  'D:/tampalets/saas-one/apps/web/src/app/[locale]/contact/page.tsx',
  'D:/tampalets/saas-one/apps/web/src/app/[locale]/pricing/page.tsx',
  'D:/tampalets/saas-one/apps/web/src/app/[locale]/solutions/page.tsx',
  'D:/tampalets/saas-one/apps/web/src/app/[locale]/(auth)/login/page.tsx',
  'D:/tampalets/saas-one/apps/web/src/app/[locale]/(auth)/register/page.tsx',
  'D:/tampalets/saas-one/apps/web/src/app/[locale]/(auth)/setup-workspace/page.tsx',
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  content = content
    .replace(/bg-sky-400\/\[0\.08\] dark:bg-sky-400\/\[0\.05\]/g, 'bg-neutral-400/[0.08] dark:bg-neutral-400/[0.05]')
    .replace(/bg-white dark:bg-sky-500\/10 border border-neutral-200 dark:border-sky-500\/20 text-sky-600 dark:text-sky-400/g, 'bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-[#1a1a1a] dark:text-white')
    .replace(/text-sky-500/g, 'text-neutral-500 dark:text-neutral-400')
    .replace(/text-sky-600 dark:text-sky-400/g, 'text-[#1a1a1a] dark:text-white')
    .replace(/text-sky-400/g, 'text-neutral-400')
    .replace(/text-sky-100/g, 'text-neutral-400 dark:text-neutral-500')
    .replace(/bg-sky-100 dark:bg-sky-500\/10/g, 'bg-neutral-100 dark:bg-white/5')
    .replace(/bg-sky-50 dark:bg-sky-500\/10/g, 'bg-neutral-100 dark:bg-white/5')
    .replace(/bg-sky-500\/20/g, 'bg-neutral-500/20')
    .replace(/bg-gradient-to-br from-sky-500 to-blue-600 text-white/g, 'bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a]')
    .replace(/shadow-\[0_20px_40px_-10px_rgba\(56,189,248,0\.4\)\]/g, 'shadow-2xl dark:shadow-none')
    .replace(/bg-sky-500 text-white/g, 'bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a]')
    .replace(/bg-sky-500/g, 'bg-[#1a1a1a] dark:bg-white')
    .replace(/hover:bg-sky-400/g, 'hover:bg-neutral-800 dark:hover:bg-neutral-200')
    .replace(/hover:bg-sky-50/g, 'hover:bg-neutral-100 dark:hover:bg-neutral-200')
    .replace(/focus:border-sky-500 focus:ring-1 focus:ring-sky-500/g, 'focus:border-[#1a1a1a] dark:focus:border-white focus:ring-1 focus:ring-[#1a1a1a] dark:focus:ring-white')
    .replace(/bg-amber-50 dark:bg-amber-500\/10 text-amber-500/g, 'bg-neutral-100 dark:bg-white/5 text-[#1a1a1a] dark:text-white')
    .replace(/text-amber-400/g, 'text-neutral-400')
    .replace(/bg-gradient-to-bl from-amber-100 to-amber-50 dark:from-amber-500\/10 dark:to-transparent border border-amber-200 dark:border-amber-500\/20/g, 'bg-neutral-50 dark:bg-[#0f0f12] border border-neutral-200 dark:border-white/5')
    .replace(/bg-rose-50 dark:bg-rose-500\/10 text-rose-500/g, 'bg-neutral-100 dark:bg-white/5 text-[#1a1a1a] dark:text-white')
    .replace(/bg-violet-50 dark:bg-violet-500\/10 text-violet-500/g, 'bg-neutral-100 dark:bg-white/5 text-[#1a1a1a] dark:text-white')
    .replace(/text-violet-400/g, 'text-neutral-400')
    .replace(/bg-gradient-to-br from-violet-100 to-violet-50 dark:from-violet-500\/10 dark:to-transparent border border-violet-200 dark:border-violet-500\/20/g, 'bg-neutral-50 dark:bg-[#0f0f12] border border-neutral-200 dark:border-white/5')
    .replace(/bg-gradient-to-br from-sky-100 to-sky-50 dark:from-sky-500\/10 dark:to-transparent border border-sky-200 dark:border-sky-500\/20/g, 'bg-neutral-50 dark:bg-[#0f0f12] border border-neutral-200 dark:border-white/5')
    .replace(/text-emerald-500/g, 'text-neutral-400 dark:text-neutral-500')
    .replace(/bg-emerald-100 text-emerald-700 dark:bg-emerald-500\/20 dark:text-emerald-400/g, 'bg-neutral-200 text-[#1a1a1a] dark:bg-white/10 dark:text-white')
    .replace(/bg-emerald-50 dark:bg-emerald-500\/10 text-emerald-600 dark:text-emerald-400/g, 'bg-neutral-100 dark:bg-white/5 text-[#1a1a1a] dark:text-white');
    
  fs.writeFileSync(file, content);
});
console.log('Colors replaced successfully');
