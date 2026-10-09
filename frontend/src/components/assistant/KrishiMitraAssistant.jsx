import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  X, 
  Minimize2, 
  Maximize2, 
  Volume2, 
  VolumeX, 
  Mic, 
  MicOff, 
  Sparkles, 
  RefreshCw, 
  Sprout, 
  Droplet, 
  FlaskConical, 
  TrendingUp, 
  Globe, 
  Check 
} from 'lucide-react';
import { cn } from '../../utils/cn';

const SUGGESTIONS = {
  en: [
    { label: "💧 Should I irrigate today?", query: "Check my current soil moisture and tell me if I should irrigate today." },
    { label: "🌾 Best crop for my soil?", query: "What is the best recommended crop for my current soil N-P-K and temperature?" },
    { label: "🧪 What fertilizer to apply?", query: "Which fertilizer mix is recommended for my field right now?" },
    { label: "📊 Expected harvest yield?", query: "What is the predicted harvest yield forecast for my farm?" }
  ],
  hi: [
    { label: "💧 क्या आज सिंचाई करनी चाहिए?", query: "मेरी मिट्टी में नमी कितनी है और क्या मुझे आज खेत में पानी देना चाहिए?" },
    { label: "🌾 इस मौसम में कौन सी फसल लगाएं?", query: "वर्तमान मिट्टी और तापमान के अनुसार मेरे खेत के लिए सबसे अच्छी फसल कौन सी है?" },
    { label: "🧪 खाद की मात्रा और सलाह बताएं", query: "मेरे खेत के लिए इस समय कौन सी खाद और कितनी मात्रा उपयुक्त है?" },
    { label: "📊 अनुमानित पैदावार कितनी होगी?", query: "मेरी फसल की अनुमानित उपज क्या रहने वाली है?" }
  ],
  mr: [
    { label: "💧 आज शेताला पाणी द्यावे का?", query: "माझ्या शेतातील मातीत ओलावा किती आहे आणि आज पाणी देण्याची गरज आहे का?" },
    { label: "🌾 कोणते पीक घेणे फायदेशीर ठरेल?", query: "माझ्या मातीच्या पोत आणि हवामानानुसार सर्वात चांगले पीक कोणते आहे?" },
    { label: "🧪 खतांचे योग्य नियोजन सांगा", query: "सध्या पिकासाठी कोणते खत वापरावे आणि त्याचे प्रमाण काय असावे?" },
    { label: "📊 अपेक्षित उत्पादन किती निघेल?", query: "माझ्या शेतातून किती उत्पादनाचा अंदाज आहे?" }
  ],
  gu: [
    { label: "💧 શું આજે પિયત આપવું જોઈએ?", query: "મારા ખેતરની જમીનમાં ભેજ કેટલો છે અને શું આજે પાણી આપવું જરૂરી છે?" },
    { label: "🌾 કયો પાક સૌથી સારો રહેશે?", query: "મારી જમીન અને તાપમાન મુજબ કયો પાક સૌથી સારો ઉત્પાદન આપશે?" }
  ],
  ta: [
    { label: "💧 இன்று பாசனம் செய்ய வேண்டுமா?", query: "என் நிலத்தின் மண் ஈரப்பதம் எவ்வளவு மற்றும் இன்று நீர் பாய்ச்ச வேண்டுமா?" },
    { label: "🌾 சிறந்த பயிர் பரிந்துரை என்ன?", query: "தற்போதைய மண் மற்றும் காலநிலைக்கு ஏற்ற சிறந்த பயிர் எது?" }
  ],
  te: [
    { label: "💧 ఈరోజు నీటి పారుదల చేయాలా?", query: "నా పొలంలో నేల తేమ ఎంత ఉంది અને ఈరోజు నీరు పెట్టాలా?" },
    { label: "🌾 ఏ పంట వేస్తే అధిక దిగుబడి?", query: "ప్రస్తుత నేల మరియు ఉష్ణోగ్రతకు అత్యంత అనువైన పంట ఏది?" }
  ]
};

export const KrishiMitraAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: "राम राम / नमस्ते किसान भाई! मैं **कृषि मित्र (KrishiMitra)** हूँ। आपके खेत के लाइव सेंसर और फसल सलाह मेरे पास उपलब्ध हैं। आप मुझसे सिंचाई, उपयुक्त फसल, खाद की मात्रा या उपज के बारे में किसी भी भाषा में पूछ सकते हैं!",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem('krishiloop_lang') || 'hi');
  const messagesEndRef = useRef(null);

  // Sync with global platform language
  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem('krishiloop_lang');
      if (saved && saved !== lang) setLang(saved);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [lang]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  // Text-To-Speech helper
  const speakText = (text) => {
    if (!speechEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      // Strip markdown asterisks and hash symbols
      const cleanText = text.replace(/[*#_`]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      // Select appropriate language voice if available
      const langMap = { hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN', ta: 'ta-IN', te: 'te-IN', en: 'en-IN' };
      utterance.lang = langMap[lang] || 'hi-IN';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis warning:', e);
    }
  };

  // Voice Input (Speech to Text)
  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please type your message.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      const langMap = { hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN', ta: 'ta-IN', te: 'te-IN', en: 'en-US' };
      recognition.lang = langMap[lang] || 'hi-IN';
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (err) {
      console.warn("Speech recognition error:", err);
      setIsListening(false);
    }
  };

  const handleSend = async (queryText) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || isLoading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history for context
      const history = messages.slice(-4).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('http://127.0.0.1:8000/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          language: lang,
          history: history
        })
      });

      const data = await res.json();
      const reply = data.reply || "कृषि मित्र से जुड़ने में असमर्थ। कृपया पुनः प्रयास करें।";

      const botMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        model: data.model,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
      speakText(reply);

    } catch (err) {
      console.error("Chat error:", err);
      const errMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "नमस्ते किसान भाई! नेटवर्क में कुछ रुकावट आई है, लेकिन आपके खेत के सेंसर सुरक्षित रूप से काम कर रहे हैं।",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const currentSuggestions = SUGGESTIONS[lang] || SUGGESTIONS.en;

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in duration-300">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-[var(--accent-primary)] text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all group border-2 border-white/20"
            title="Chat with KrishiMitra AI / कृषि मित्र से बात करें"
          >
            <div className="relative">
              <Sprout className="w-5 h-5 text-emerald-300 group-hover:rotate-12 transition-transform" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-extrabold tracking-tight leading-tight flex items-center gap-1">
                KrishiMitra AI <Sparkles className="w-3 h-3 text-amber-300 inline" />
              </span>
              <span className="text-[10px] text-white/80 font-medium">
                कृषि मित्र (NVIDIA GLM)
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[95vw] sm:w-[420px] h-[580px] max-h-[85vh] bg-white dark:bg-[#0E1511] hairline-border rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="p-4 bg-[var(--accent-primary)] text-white flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-emerald-300 border border-white/20 shadow-inner">
                <Sprout className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-sm tracking-tight">KrishiMitra AI</h3>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/20 text-white uppercase tracking-wider">
                    NVIDIA GLM-5.3
                  </span>
                </div>
                <p className="text-[11px] text-white/80 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  Real-Time Farm Intelligence
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* TTS Voice Toggle */}
              <button
                onClick={() => {
                  if (speechEnabled && window.speechSynthesis) window.speechSynthesis.cancel();
                  setSpeechEnabled(!speechEnabled);
                }}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  speechEnabled ? "bg-white/20 text-white" : "bg-black/20 text-white/60 hover:text-white"
                )}
                title={speechEnabled ? "Voice Speech Enabled (बोलकर सुनाएं)" : "Speech Muted"}
              >
                {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Close Button */}
              <button
                onClick={() => {
                  if (window.speechSynthesis) window.speechSynthesis.cancel();
                  setIsOpen(false);
                }}
                className="p-2 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                title="Minimize Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Suggestions Strip */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-black/20 border-b border-black/[0.04] dark:border-white/[0.06] overflow-x-auto scrollbar-none flex gap-1.5 shrink-0">
            {currentSuggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s.query)}
                disabled={isLoading}
                className="whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white dark:bg-[#15201A] hairline-border text-slate-700 dark:text-slate-300 hover:bg-[var(--accent-tint)] hover:text-[var(--accent-primary)] transition-all shrink-0 active:scale-95 shadow-xs"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8F9F8] dark:bg-[#0A100C]">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={cn("flex flex-col max-w-[85%]", isUser ? "ml-auto items-end" : "mr-auto items-start")}
                >
                  <div
                    className={cn(
                      "p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm",
                      isUser
                        ? "bg-[var(--accent-primary)] text-white rounded-br-xs"
                        : "bg-white dark:bg-[#121B16] text-slate-800 dark:text-slate-200 hairline-border rounded-bl-xs"
                    )}
                  >
                    <div className="whitespace-pre-wrap font-sans">
                      {m.content}
                    </div>

                    {!isUser && (
                      <div className="mt-2 pt-1.5 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-[10px] text-slate-400">
                        <span>{m.model ? `Engine: ${m.model}` : 'KrishiMitra'}</span>
                        <button
                          onClick={() => speakText(m.content)}
                          className="hover:text-[var(--accent-mid)] flex items-center gap-1 font-semibold"
                          title="Listen to this advisory"
                        >
                          <Volume2 className="w-3 h-3" /> Listen
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">{m.time}</span>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-white dark:bg-[#121B16] hairline-border max-w-[70%] mr-auto text-xs text-slate-500">
                <Sprout className="w-4 h-4 text-[var(--accent-mid)] animate-spin" />
                <span>कृषि मित्र सोच रहा है (Analyzing live sensors)...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white dark:bg-[#0E1511] border-t hairline-border flex items-center gap-2 shrink-0"
          >
            {/* Microphone Voice Input */}
            <button
              type="button"
              onClick={toggleListening}
              className={cn(
                "p-2.5 rounded-full hairline-border transition-all shadow-sm",
                isListening
                  ? "bg-rose-500 text-white animate-pulse"
                  : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              )}
              title={isListening ? "Listening... (बोलिए)" : "Speak your question (माइक दबाकर बोलें)"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Message Input */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything in Hindi, Marathi, English... / कुछ भी पूछें"
              disabled={isLoading}
              className="flex-1 px-3.5 py-2.5 rounded-full bg-slate-100 dark:bg-white/5 hairline-border text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] transition-all"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={cn(
                "p-2.5 rounded-full text-white shadow-sm transition-all",
                input.trim() && !isLoading
                  ? "bg-[var(--accent-primary)] hover:opacity-95 active:scale-95"
                  : "bg-slate-300 dark:bg-white/10 cursor-not-allowed opacity-60"
              )}
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default KrishiMitraAssistant;
