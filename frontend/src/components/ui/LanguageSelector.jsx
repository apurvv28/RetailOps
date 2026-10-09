import React, { useState, useEffect, useRef } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
];

export const LanguageSelector = ({ variant = 'default', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(() => {
    // Check cookie first, then localStorage
    const match = document.cookie.match(/googtrans=\/en\/([a-z]{2})/i);
    if (match && match[1]) return match[1].toLowerCase();
    return localStorage.getItem('krishiloop_lang') || 'en';
  });
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeLanguage = (langCode) => {
    setCurrentLang(langCode);
    localStorage.setItem('krishiloop_lang', langCode);
    setIsOpen(false);

    // Set Google Translate cookie on root path and all subdomains
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    
    // Cookie format for Google Translate: /en/<target>
    const cookieVal = `/en/${langCode}`;
    document.cookie = `googtrans=${cookieVal}; path=/;`;
    if (!isLocal) {
      document.cookie = `googtrans=${cookieVal}; path=/; domain=.${host};`;
    }

    // Try setting the hidden google translate combo directly for real-time switch
    const combo = document.querySelector('.goog-te-combo');
    if (combo) {
      combo.value = langCode;
      combo.dispatchEvent(new Event('change'));
    } else {
      // If the translate element isn't attached yet, reload to let the cookie take effect instantly
      window.location.reload();
    }
  };

  const activeLang = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];

  return (
    <div className={cn("relative inline-block text-left notranslate", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold hairline-border transition-all shadow-sm select-none",
          isOpen
            ? "bg-[var(--accent-tint)] dark:bg-[var(--accent-dark-tint)] text-[var(--accent-primary)] dark:text-[var(--accent-light)] ring-2 ring-[var(--accent-primary)]"
            : "bg-white dark:bg-[#121A15] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
        )}
        title="Change Language / भाषा बदलें"
      >
        <Globe className="w-3.5 h-3.5 text-[var(--accent-mid)] dark:text-[var(--accent-light)] shrink-0" />
        <span className="font-bold">{activeLang.native}</span>
        <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#121A15] hairline-border rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 border-b border-black/[0.05] dark:border-white/[0.06] mb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Select Language / भाषा चुनें
            </p>
          </div>
          <div className="space-y-0.5 px-1.5">
            {LANGUAGES.map((lang) => {
              const isSelected = lang.code === currentLang;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => changeLanguage(lang.code)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left",
                    isSelected
                      ? "bg-[var(--accent-tint)] dark:bg-[var(--accent-dark-tint)] text-[var(--accent-primary)] dark:text-[var(--accent-light)] font-bold"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base leading-none">{lang.flag}</span>
                    <div className="flex flex-col">
                      <span className="leading-tight font-semibold">{lang.native}</span>
                      <span className="text-[10px] text-slate-400">{lang.label}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[var(--accent-primary)] dark:text-[var(--accent-light)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
