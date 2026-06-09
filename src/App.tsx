/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { Power, PowerOff, Shield, ShieldOff, Plus, Trash2, Info, Settings, ArrowLeft, Key, Target, Loader2, CheckCircle2 } from 'lucide-react';
import {
  type MCQ,
  QUIZ_SLOT_COUNT,
  pickWarmupQuestions,
  shouldUseWarmupQuestions,
} from './lib/fallbackQuestions';

const REVEAL_DELAY_MS = 320;

const isExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

const FREE_OPENROUTER_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'qwen/qwen-2.5-7b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'openrouter/free',
] as const;

const QUIZ_FETCH_TIMEOUT_MS = 35_000;

function getBlockedDomainKey(hostname: string, blockedDomains: string[]): string {
  const host = hostname.replace(/^www\./, '').toLowerCase();
  const sorted = [...blockedDomains].sort((a, b) => b.length - a.length);
  for (const domain of sorted) {
    const d = domain.toLowerCase();
    if (host === d || host.endsWith('.' + d)) return d;
  }
  return host;
}

function normalizeTargetUrl(url: string): string {
  return url.startsWith('http') ? url : `https://${url}`;
}

const DEFAULT_DOMAINS = [
  'netflix.com', 
  'youtube.com', 
  'instagram.com', 
  'facebook.com', 
  'twitter.com', 
  'tiktok.com'
];

type FocusBlockStorage = {
  isBlocking?: boolean;
  blockedDomains?: string[];
  unlockedSites?: Record<string, number>;
  openRouterKey?: string;
  learningGoal?: string;
};

export default function App() {
  const [targetUrl, setTargetUrl] = useState<string | null>(null);

  useEffect(() => {
    // If the URL has ?target=..., we're acting as the full-page interceptor
    const searchParams = new URLSearchParams(window.location.search);
    const target = searchParams.get('target');
    if (target) {
      setTargetUrl(decodeURIComponent(target));
    }
  }, []);

  // Return interceptor view if we caught a blocked site
  if (targetUrl) {
    return <FocusInterceptor targetUrl={targetUrl} />;
  }

  // Otherwise return the popup UI
  return <PopupManager />;
}

function PopupManager() {
  const [view, setView] = useState<'main' | 'settings'>('main');

  return (
    <div className={`bg-stone-50 dark:bg-stone-950 flex flex-col font-sans text-stone-900 dark:text-stone-100 ${
      isExtension ? 'w-[400px] min-h-[560px] p-3' : 'w-full min-h-screen items-center p-4 pt-8 md:p-8'
    }`}>
      <div className="w-full bg-white dark:bg-stone-900 rounded-[40px] shadow-sm overflow-hidden border border-stone-200 dark:border-stone-700">
        
        {/* Navigation Bar */}
        <div className="w-full px-6 py-4 flex justify-between items-center border-b border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900">
          <div className="flex items-center gap-2">
             {view === 'settings' && (
               <button onClick={() => setView('main')} className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg text-stone-500 dark:text-stone-400 transition-colors">
                 <ArrowLeft size={18} />
               </button>
             )}
             <img src="./icons/focus.svg" alt="" className="w-6 h-6 dark:invert" />
             <span className="font-semibold text-stone-700 dark:text-stone-200 tracking-tight">FocusBlock</span>
          </div>
          {view === 'main' && (
            <button onClick={() => setView('settings')} className="p-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-full text-stone-600 dark:text-stone-300 transition-colors">
              <Settings size={18} />
            </button>
          )}
        </div>

        {view === 'main' ? <MainPanel /> : <SettingsPanel />}
        
      </div>
      
      {/* Web Preview Banner */}
      {!isExtension && (
        <div className="w-full max-w-sm mt-8 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-[32px] p-6 shadow-sm text-stone-800 dark:text-stone-200">
          <div className="flex items-start gap-4">
            <Info size={24} className="text-stone-400 flex-shrink-0" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Web Preview Mode</h3>
              <p className="text-sm text-stone-600 leading-relaxed font-light mb-4">
                You are viewing the popup interface securely in the web preview. To test the AI Quiz intercept, add "<b>?target=https://netflix.com</b>" to your browser URL right now!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatUnlockTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function MainPanel() {
  const [isBlocking, setIsBlocking] = useState(false);
  const [domains, setDomains] = useState<string[]>(DEFAULT_DOMAINS);
  const [newDomain, setNewDomain] = useState('');
  const [activeUnlocks, setActiveUnlocks] = useState<{ domain: string; expires: number }[]>([]);

  useEffect(() => {
    if (isExtension) {
      chrome.storage.local.get(['isBlocking', 'blockedDomains'], (res) => {
        if (res.isBlocking !== undefined) setIsBlocking(res.isBlocking);
        if (res.blockedDomains !== undefined) setDomains(res.blockedDomains);
      });
    } else {
      const savedBlock = localStorage.getItem('isBlocking');
      const savedDomains = localStorage.getItem('blockedDomains');
      if (savedBlock) setIsBlocking(JSON.parse(savedBlock));
      if (savedDomains) setDomains(JSON.parse(savedDomains));
    }
  }, []);

  useEffect(() => {
    if (!isExtension) return;

    const refreshUnlocks = () => {
      chrome.storage.local.get(['unlockedSites'], (res) => {
        const unlocked = (res.unlockedSites || {}) as Record<string, number>;
        const now = Date.now();
        setActiveUnlocks(
          Object.entries(unlocked)
            .filter(([, expires]) => expires > now)
            .map(([domain, expires]) => ({ domain, expires }))
        );
      });
    };

    refreshUnlocks();
    const interval = setInterval(refreshUnlocks, 1000);
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.unlockedSites) refreshUnlocks();
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      clearInterval(interval);
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, []);

  const toggleBlock = async () => {
    const newVal = !isBlocking;
    setIsBlocking(newVal);
    if (isExtension) {
      await chrome.storage.local.set({ isBlocking: newVal });
      if (newVal) {
        try {
          await chrome.runtime.sendMessage({ type: 'REFRESH_RULES' });
        } catch {
          // Service worker will still pick up storage.onChanged
        }
      }
    } else {
      localStorage.setItem('isBlocking', JSON.stringify(newVal));
    }
  };

  const addDomain = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDomain.trim().toLowerCase();
    if (!trimmed || domains.includes(trimmed)) return;
    
    let domainToAdd = trimmed;
    try {
        if (domainToAdd.startsWith('http')) {
            domainToAdd = new URL(domainToAdd).hostname;
        }
        domainToAdd = domainToAdd.replace(/^www\./, '');
    } catch (e) {
    }
    
    const newDomains = [...domains, domainToAdd];
    updateDomains(newDomains);
    setNewDomain('');
  };

  const removeDomain = (domainToRemove: string) => {
    const newDomains = domains.filter((d) => d !== domainToRemove);
    updateDomains(newDomains);
  };

  const updateDomains = (newDomains: string[]) => {
    setDomains(newDomains);
    if (isExtension) {
      chrome.storage.local.set({ blockedDomains: newDomains });
    } else {
      localStorage.setItem('blockedDomains', JSON.stringify(newDomains));
    }
  };

  return (
    <>
      <div className="p-10 flex flex-col items-center justify-center border-b border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900">
        <button
          type="button"
          role="switch"
          aria-checked={isBlocking}
          onClick={toggleBlock}
          className={`relative mb-8 mt-2 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500 dark:focus-visible:ring-offset-stone-900 ${
            isBlocking
              ? 'bg-green-500 text-white shadow-green-500/25'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500'
          }`}
        >
          {isBlocking ? <Power size={48} className="stroke-[2]" /> : <PowerOff size={48} className="stroke-[1.5]" />}
        </button>

        <h1 className="text-2xl font-light tracking-tight text-stone-900 dark:text-stone-100">
          Silence the <span className="italic font-serif">noise.</span>
        </h1>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-stone-400 dark:text-stone-500">
          {isBlocking ? <Shield size={14} /> : <ShieldOff size={14} />}
          {isBlocking ? 'Focus Mode Active' : 'Focus Mode Disabled'}
        </p>
      </div>

      {activeUnlocks.length > 0 && (
        <div className="px-8 py-4 bg-white dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
            Active Unlocks
          </h2>
          <div className="space-y-2">
            {activeUnlocks.map(({ domain, expires }) => (
              <div
                key={domain}
                className="flex items-center justify-between rounded-2xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-2.5"
              >
                <span className="text-sm text-stone-700 dark:text-stone-200">{domain}</span>
                <span className="text-sm font-semibold tabular-nums text-green-600 dark:text-green-400">
                  {formatUnlockTime(expires - Date.now())}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-8 bg-white dark:bg-stone-900">
        <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-6">
          Blocked Sites
        </h2>
        
        <form onSubmit={addDomain} className="flex gap-3 mb-6">
          <input 
            type="text" 
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="e.g. reddit.com" 
            className="flex-1 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-2xl px-4 py-3 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:bg-white dark:focus:bg-stone-800 transition-all shadow-sm"
          />
          <button 
            type="submit" 
            disabled={!newDomain.trim()}
            className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-4 py-3 rounded-2xl hover:bg-stone-800 dark:hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Plus size={20} />
          </button>
        </form>

        <div className="space-y-0 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {domains.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-6 italic font-light">No sites blocked.</p>
          ) : (
            domains.map((domain) => (
              <div key={domain} className="group flex items-center justify-between py-3 border-b border-stone-100 dark:border-stone-800 last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors px-2 -mx-2 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${isBlocking ? 'bg-red-400' : 'bg-stone-200 dark:bg-stone-600'}`}></div>
                  <span className="text-base text-stone-700 dark:text-stone-200 tracking-tight">{domain}</span>
                </div>
                <button 
                  onClick={() => removeDomain(domain)}
                  className="text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 transition-colors focus:outline-none p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 ml-2"
                  title="Remove site"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function SettingsPanel() {
  const [apiKey, setApiKey] = useState('');
  const [goal, setGoal] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isExtension) {
      chrome.storage.local.get(['openRouterKey', 'learningGoal'], (res) => {
        if (res.openRouterKey) setApiKey(res.openRouterKey);
        if (res.learningGoal) setGoal(res.learningGoal);
      });
    } else {
      setApiKey(localStorage.getItem('openRouterKey') || '');
      setGoal(localStorage.getItem('learningGoal') || '');
    }
  }, []);

  const handleSave = () => {
    if (isExtension) {
      chrome.storage.local.set({ openRouterKey: apiKey, learningGoal: goal });
    } else {
      localStorage.setItem('openRouterKey', apiKey);
      localStorage.setItem('learningGoal', goal);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-8 bg-white dark:bg-stone-900">
      <h2 className="text-xl font-light tracking-tight text-stone-900 dark:text-stone-100 mb-6">Learning Settings</h2>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-8 leading-relaxed">
        Add your learning topic for personalized AI quizzes (free OpenRouter models).
        Leave it blank and you&apos;ll get built-in aptitude &amp; reasoning warm-up questions instead.
      </p>

      <div className="space-y-6">
        <div>
           <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
             <Key size={14} /> OpenRouter API Key
           </label>
           <input 
             type="password"
             value={apiKey}
             onChange={e => setApiKey(e.target.value)}
             placeholder="sk-or-v1-..."
             className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-2xl px-4 py-3 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:bg-white dark:focus:bg-stone-800 transition-all shadow-sm"
           />
        </div>

        <div>
           <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
             <Target size={14} /> What is your learning goal?
           </label>
           <textarea 
             value={goal}
             onChange={e => setGoal(e.target.value)}
             placeholder="e.g. I am learning Database Management Systems and SQL optimization..."
             rows={3}
             className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-2xl px-4 py-3 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:bg-white dark:focus:bg-stone-800 transition-all shadow-sm resize-none"
           />
        </div>

        <button 
          onClick={handleSave}
          className="w-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-medium px-4 py-3.5 rounded-2xl hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          {saved ? <><CheckCircle2 size={18} /> Settings Saved</> : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}

async function fetchQuizQuestions(key: string, userGoal: string, model: string): Promise<MCQ[]> {
  const prompt = `Generate 5 multiple-choice quiz questions about: "${userGoal}". Use practical real-world scenarios. Return ONLY valid JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"answerIndex":0}]}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), QUIZ_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://focusblock.extension',
        'X-Title': 'FocusBlock',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(txt || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Invalid response from OpenRouter');

  const parsed = JSON.parse(content);
  if (!parsed?.questions || parsed.questions.length !== 5) {
    throw new Error('AI did not return exactly 5 questions.');
  }

  return parsed.questions;
}

function QuizSkeletonCard({ index }: { index: number }) {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-[32px] p-8 md:p-10 shadow-sm border border-stone-200 dark:border-stone-700">
      <div className="flex gap-3 mb-8 animate-pulse">
        <span className="text-stone-300 dark:text-stone-600 font-bold shrink-0">{index + 1}.</span>
        <div className="flex-1 space-y-3 pt-1">
          <div className="h-4 bg-stone-200 dark:bg-stone-700 rounded-full w-full" />
          <div className="h-4 bg-stone-200 dark:bg-stone-700 rounded-full w-[85%]" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[3.25rem] bg-stone-100 dark:bg-stone-800 rounded-2xl border-2 border-stone-100 dark:border-stone-800" />
        ))}
      </div>
    </div>
  );
}

async function revealQuestionsStaggered(
  quiz: MCQ[],
  onReveal: (partial: MCQ[]) => void,
): Promise<void> {
  onReveal([]);
  for (let i = 0; i < quiz.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, REVEAL_DELAY_MS));
    onReveal(quiz.slice(0, i + 1));
  }
}

// ------------------------------------------------------------------------------------------
// Full Page Focus Interceptor 
// ------------------------------------------------------------------------------------------

function FocusInterceptor({ targetUrl }: { targetUrl: string }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [unlocking, setUnlocking] = useState(false);
  const [isWarmup, setIsWarmup] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const passScore = questions.length > 0 ? Math.ceil(questions.length * 0.8) : 4;
  const isLoading = isFetching || questions.length < QUIZ_SLOT_COUNT;

  // Compute domain cleanly
  const targetDomain = React.useMemo(() => {
    try {
      if (targetUrl.startsWith('http')) {
        return new URL(targetUrl).hostname.replace(/^www\./, '');
      }
      return targetUrl;
    } catch {
      return targetUrl;
    }
  }, [targetUrl]);

  useEffect(() => {
    const init = async () => {
      let storedKey = '';
      let storedGoal = '';

      if (isExtension) {
        const res = await chrome.storage.local.get(['openRouterKey', 'learningGoal']) as FocusBlockStorage;
        storedKey = res.openRouterKey || '';
        storedGoal = res.learningGoal || '';
      } else {
        storedKey = localStorage.getItem('openRouterKey') || '';
        storedGoal = localStorage.getItem('learningGoal') || '';
      }

      setApiKey(storedKey);
      setGoal(storedGoal);

      if (shouldUseWarmupQuestions(storedGoal, storedKey)) {
        setIsWarmup(true);
        loadWarmupQuestions();
        return;
      }

      fetchQuestions(storedKey, storedGoal);
    };
    init();
  }, []);

  const finishReveal = async (quiz: MCQ[]) => {
    setIsFetching(false);
    await revealQuestionsStaggered(quiz, setQuestions);
  };

  const loadWarmupQuestions = async () => {
    setError(null);
    setIsFetching(true);
    setQuestions([]);
    setSubmitted(false);
    setUserAnswers({});
    setScore(0);
    await new Promise((resolve) => setTimeout(resolve, 400));
    await finishReveal(pickWarmupQuestions());
  };

  const fetchQuestions = async (key: string, userGoal: string) => {
    setError(null);
    setIsFetching(true);
    setQuestions([]);
    setIsWarmup(false);

    let lastError = 'All free models failed.';
    for (const model of FREE_OPENROUTER_MODELS) {
      try {
        const quiz = await fetchQuizQuestions(key, userGoal, model);
        await finishReveal(quiz);
        return;
      } catch (e: unknown) {
        const err = e as { name?: string; message?: string };
        const msg = err.name === 'AbortError' ? `Timed out (${QUIZ_FETCH_TIMEOUT_MS / 1000}s)` : err.message || 'Unknown error';
        console.warn(`Free model ${model} failed:`, msg);
        lastError = msg;
      }
    }

    setIsWarmup(true);
    await finishReveal(pickWarmupQuestions());
    console.warn('AI quiz failed, using warmup questions:', lastError);
  };

  const reloadQuiz = () => {
    if (isWarmup || shouldUseWarmupQuestions(goal || '', apiKey || '')) {
      loadWarmupQuestions();
    } else {
      fetchQuestions(apiKey!, goal!);
    }
  };

  const toggleAnswer = (qIndex: number, optionIndex: number) => {
    if (submitted) return;
    setUserAnswers(prev => ({ ...prev, [qIndex]: optionIndex }));
  };

  const submitQuiz = () => {
    if (Object.keys(userAnswers).length < questions.length) return;
    let correct = 0;
    questions.forEach((q, i) => {
      if (userAnswers[i] === q.answerIndex) correct++;
    });
    setScore(correct);
    setSubmitted(true);
  };

  const handleUnlock = async () => {
    const requiredScore = Math.ceil(questions.length * 0.8);
    if (score >= requiredScore) {
      setUnlocking(true);
      const destination = normalizeTargetUrl(targetUrl);

      if (isExtension) {
        const res = await chrome.storage.local.get(['blockedDomains', 'unlockedSites']) as FocusBlockStorage;
        const blockedDomains = res.blockedDomains ?? DEFAULT_DOMAINS;
        const unlockKey = getBlockedDomainKey(targetDomain, blockedDomains);
        const timeout = Date.now() + 30 * 60 * 1000;
        const unlockedSites = res.unlockedSites || {};
        unlockedSites[unlockKey] = timeout;

        await chrome.storage.local.set({ unlockedSites });
        await chrome.alarms.create(`relock_${unlockKey}`, { delayInMinutes: 30 });
        // Wait for background to remove block rule before navigating (fixes re-redirect loop)
        await chrome.runtime.sendMessage({ type: 'REFRESH_RULES' });
      }

      window.location.replace(destination);
    } else {
      // Failed - reload questions to try again
      setSubmitted(false);
      setUserAnswers({});
      setScore(0);
      reloadQuiz();
    }
  };

  const loadStatusMessage = isWarmup
    ? isFetching
      ? 'Warming up your brain...'
      : `Loading question ${questions.length + 1} of ${QUIZ_SLOT_COUNT}...`
    : isFetching
      ? 'Generating your quiz...'
      : `Loading question ${questions.length + 1} of ${QUIZ_SLOT_COUNT}...`;

  if (error) {
    return (
      <div className="w-full min-h-screen bg-stone-900 flex flex-col items-center justify-center p-6 text-white font-sans text-center">
         <div className="bg-white/10 p-8 rounded-[40px] max-w-lg w-full backdrop-blur-md border border-white/10 shadow-2xl">
           <ShieldOff size={48} className="mx-auto text-red-400 mb-6" />
           <h1 className="text-2xl font-light tracking-tight mb-4">Cannot access {targetDomain}</h1>
           <p className="text-stone-300 font-light mb-8">{error}</p>
           {!isExtension && (
             <button onClick={() => window.location.href="/"} className="bg-white text-stone-900 px-6 py-3 rounded-full font-medium">Return to preview</button>
           )}
         </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col items-center p-8 py-12 md:py-20 text-stone-900 dark:text-stone-100 font-sans custom-scrollbar overflow-y-auto">
      
      <div className="max-w-3xl w-full">
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-4">
            Silence the <span className="italic font-serif">noise.</span>
          </h1>
          <p className="text-lg text-stone-500 dark:text-stone-400 max-w-xl mx-auto font-light leading-relaxed">
            You are trying to access <strong className="font-semibold text-stone-700 dark:text-stone-200">{targetDomain}</strong> which is blocked. Score 80% or higher on this quiz to unlock it for 30 minutes!
          </p>
          {isWarmup && !isLoading && (
            <p className="mt-4 text-sm text-stone-400 dark:text-stone-500 max-w-lg mx-auto">
              Aptitude &amp; reasoning warm-up — add a learning topic in settings for personalized questions.
            </p>
          )}
        </header>

        {/* Quiz Area */}
        <div className="space-y-8 mb-12">
          {Array.from({ length: QUIZ_SLOT_COUNT }).map((_, slotIndex) => {
            const q = questions[slotIndex];
            if (!q) {
              return (
                <React.Fragment key={`skeleton-${slotIndex}`}>
                  <QuizSkeletonCard index={slotIndex} />
                </React.Fragment>
              );
            }
            const qIndex = slotIndex;
            return (
            <div key={qIndex} className="bg-white dark:bg-stone-900 rounded-[32px] p-8 md:p-10 shadow-sm border border-stone-200 dark:border-stone-700 transition-opacity duration-300">
               <h3 className="text-lg md:text-xl font-medium text-stone-800 dark:text-stone-100 mb-8 leading-relaxed">
                 <span className="text-stone-400 dark:text-stone-500 font-bold mr-3">{qIndex + 1}.</span> {q.question}
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {q.options.map((opt, oIndex) => {
                   const isSelected = userAnswers[qIndex] === oIndex;
                   const isCorrect = q.answerIndex === oIndex;
                   const showCorrect = submitted && isCorrect;
                   const showWrong = submitted && isSelected && !isCorrect;

                   let btnClass = "text-left p-5 rounded-2xl border-2 transition-all duration-300 ";
                   if (showCorrect) {
                     btnClass += "bg-green-50 dark:bg-green-950/40 border-green-500 text-green-900 dark:text-green-200 shadow-sm";
                   } else if (showWrong) {
                     btnClass += "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-900 dark:text-red-200";
                   } else if (isSelected) {
                     btnClass += "bg-stone-900 dark:bg-stone-100 border-stone-900 dark:border-stone-100 text-white dark:text-stone-900 shadow-md";
                   } else {
                     btnClass += "bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-stone-400 dark:hover:border-stone-500 hover:bg-white dark:hover:bg-stone-700";
                   }

                   return (
                     <button 
                       key={oIndex} 
                       onClick={() => toggleAnswer(qIndex, oIndex)}
                       disabled={submitted || isLoading}
                       className={btnClass}
                     >
                        <span className="font-medium">{opt}</span>
                     </button>
                   );
                 })}
               </div>
            </div>
            );
          })}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-3 mb-10 text-stone-500 dark:text-stone-400">
            <Loader2 size={20} className="animate-spin shrink-0" />
            <span className="text-sm font-medium tracking-wide">{loadStatusMessage}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col items-center">
          {!submitted ? (
            <button 
              onClick={submitQuiz}
              disabled={isLoading || Object.keys(userAnswers).length < questions.length}
              className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-12 py-5 rounded-full text-lg font-medium tracking-wide hover:bg-stone-800 dark:hover:bg-stone-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              Submit Answers
            </button>
          ) : (
             <div className="w-full bg-white dark:bg-stone-900 rounded-[40px] p-10 text-center shadow-xl border border-stone-200 dark:border-stone-700">
               <h2 className="text-4xl font-light mb-4">
                 You scored <span className="font-semibold">{score}/{questions.length}</span>
               </h2>
               
               {score >= passScore ? (
                 <>
                   <p className="text-green-600 dark:text-green-400 font-medium mb-8 text-lg">Great job! You proved your focus. Site unlocked for 30 minutes.</p>
                   <button 
                     onClick={handleUnlock}
                     disabled={unlocking}
                     className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-10 py-4 rounded-full text-lg font-medium tracking-wide hover:scale-105 transition-transform shadow-lg disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2 mx-auto"
                   >
                     {unlocking ? <><Loader2 size={20} className="animate-spin" /> Unlocking...</> : `Continue to ${targetDomain}`}
                   </button>
                 </>
               ) : (
                 <>
                   <p className="text-red-500 dark:text-red-400 font-medium mb-8 text-lg">You need 80% (4/5) to unlock this site. Stay focused on your goals!</p>
                   <button 
                     onClick={handleUnlock}
                     className="bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100 px-10 py-4 rounded-full text-lg font-medium tracking-wide hover:bg-stone-300 dark:hover:bg-stone-600 transition-colors"
                   >
                     Try again with new questions
                   </button>
                 </>
               )}
             </div>
          )}
        </div>

      </div>
    </div>
  );
}
