import React, { useState, useEffect, useRef } from 'react';
import WebGLBackground from './WebGLBackground';
import ReactMarkdown from 'react-markdown';
import { Preferences } from '@capacitor/preferences';

type Message = {
    role: 'user' | 'model';
    text: string;
    responseTimeMs?: number;
};

type ChatSession = {
    id: string;
    title: string;
    messages: Message[];
};

export default function App() {
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [historySessions, setHistorySessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [titleContent, setTitleContent] = useState<React.ReactNode>(null);
  const [simStep, setSimStep] = useState(-1);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');

  const getDefaultGreeting = () => {
    const hour = new Date().getHours();
    let greeting = "Good evening";
    if (hour >= 5 && hour < 12) greeting = "Good morning";
    else if (hour >= 12 && hour < 17) greeting = "Good afternoon";

    if (Math.random() > 0.7) greeting = "Welcome back";
    return (
      <>
        {greeting},<br />
        <span className="text-[#888888] font-semibold">how can I help you<br />today?</span>
      </>
    );
  };

  useEffect(() => {
    setTitleContent(getDefaultGreeting());
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      const { value } = await Preferences.get({ key: 'chat_history' });
      if (value) {
        try {
          setHistorySessions(JSON.parse(value));
        } catch (e) {
          console.error("Failed to parse history", e);
        }
      }
    };
    loadHistory();
  }, []);

  useEffect(() => {
    Preferences.set({
      key: 'chat_history',
      value: JSON.stringify(historySessions)
    });
  }, [historySessions]);

  useEffect(() => {
    if (messages.length > 0 && activeSessionId) {
      setHistorySessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages } : s
      ));
    }
  }, [messages, activeSessionId]);

  useEffect(() => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event: any) => {
          let completeFinal = '';
          let completeInterim = '';
          
          for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              completeFinal += event.results[i][0].transcript;
            } else {
              completeInterim += event.results[i][0].transcript;
            }
          }
          
          transcriptRef.current = completeFinal.trim();
          
          if (completeFinal || completeInterim) {
            setTitleContent(
              <>
                <span className="text-[#2d2d2d] transition-colors duration-300">{completeFinal}</span>
                <span className="text-[#888888] opacity-50 transition-colors duration-300">{completeInterim}</span>
              </>
            );
          }
        };

        recognition.onend = () => {
           // We will handle stopping in the toggle itself, but if it stops naturally,
           // we can just let it be or force stop it. We need a way to trigger the end.
           // Setting a global event or calling a ref function.
           if ((window as any).handleSpeechEnd) {
             (window as any).handleSpeechEnd();
           }
        };
        
        recognitionRef.current = recognition;
      }
    } catch (e) {
      console.log("Web Speech API not supported.");
    }
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    (window as any).handleSpeechEnd = () => {
      if (isRecording) {
        stopRecording();
      }
    };
    return () => {
      delete (window as any).handleSpeechEnd;
    };
  }, [isRecording]);

  const simTexts = [
    { final: "", ghost: "What are" },
    { final: "What are", ghost: " the best ways" },
    { final: "What are the best ways", ghost: " to relax" },
    { final: "What are the best ways to relax", ghost: " after a stressful day?" },
    { final: "What are the best ways to relax after a stressful day?", ghost: "" }
  ];

  useEffect(() => {
    if (simStep >= 0 && simStep < simTexts.length) {
      const timer = setTimeout(() => {
        setTitleContent(
          <>
            <span className="text-[#2d2d2d] transition-colors duration-300">{simTexts[simStep].final}</span>
            <span className="text-[#888888] opacity-50 transition-colors duration-300">{simTexts[simStep].ghost}</span>
          </>
        );
        setSimStep(simStep + 1);
      }, 800);
      return () => clearTimeout(timer);
    } else if (simStep === simTexts.length) {
      const timer = setTimeout(() => stopRecording(), 1000);
      return () => clearTimeout(timer);
    }
  }, [simStep]);

  const startRecording = () => {
    setIsRecording(true);
    transcriptRef.current = '';
    setTitleContent(<span className="text-[#888888] opacity-50 font-semibold transition-colors duration-300">Listening...</span>);
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e: any) {
        console.warn("Speech API Error:", e);
        if (e.name !== 'InvalidStateError') {
          setSimStep(0);
        }
      }
    } else {
      setSimStep(0);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
         // ignore
      }
    }
    
    let submitted = false;

    if (simStep >= 0) {
      const isFinished = simStep === simTexts.length;
      setSimStep(-1);
      if (isFinished) {
        handleVoiceSubmit(simTexts[simTexts.length - 1].final);
        submitted = true;
      }
    }

    if (!submitted) {
      if (transcriptRef.current) {
          handleVoiceSubmit(transcriptRef.current);
      } else {
          setTitleContent(getDefaultGreeting());
      }
    }
    
    transcriptRef.current = '';
  };

  const handleVoiceSubmit = (text: string) => {
    if (!isInputOpen) {
       setIsInputOpen(true);
    }
    sendUserMessage(text);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const openInput = () => {
    setIsInputOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
  };

  const closeInput = () => {
    setIsInputOpen(false);
    setInputValue('');
    setIsTyping(false);
  };

  const [isGenerating, setIsGenerating] = useState(false);

  const sendUserMessage = async (text: string) => {
    const userMsg: Message = { role: 'user', text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      currentSessionId = Date.now().toString();
      setActiveSessionId(currentSessionId);
      
      const newSession: ChatSession = {
        id: currentSessionId,
        title: text.slice(0, 30) + '...',
        messages: newMessages
      };
      setHistorySessions(prev => [newSession, ...prev]);

      fetch('/api/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      })
      .then(res => res.json())
      .then(data => {
        if (data.title) {
          setHistorySessions(prev => prev.map(s => 
            s.id === currentSessionId ? { ...s, title: data.title } : s
          ));
        }
      })
      .catch(console.error);
    }
    
    setIsGenerating(true);
    const startTime = Date.now();
    
    setMessages(prev => [...prev, { role: 'model', text: '' }]);

    const isVoiceInput = document.activeElement !== inputRef.current && !isTyping;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: messages,
          message: text
        })
      });
      
      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let done = false;
      let modelText = '';

      setIsGenerating(false);

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') {
                done = true;
                break;
              }
              try {
                const data = JSON.parse(dataStr);
                if (data.text) {
                  modelText += data.text;
                  setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1] = { role: 'model', text: modelText };
                    return newMsgs;
                  });
                }
              } catch (e) {
                 // ignore parse errors for partial chunks
              }
            }
          }
        }
      }
      
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { role: 'model', text: modelText, responseTimeMs: Date.now() - startTime };
        return newMsgs;
      });

      if (isVoiceInput && 'speechSynthesis' in window) {
        const cleanText = modelText.replace(/[*#_`]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        window.speechSynthesis.speak(utterance);
      }

    } catch (error) {
      console.error("Failed to fetch chat:", error);
      setIsGenerating(false);
    }
  };

  const sendMessage = () => {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue('');
    setIsTyping(false);
    inputRef.current?.focus();
    sendUserMessage(text);
  };

  const handleActionClick = () => {
    if (!isInputOpen) {
      openInput();
    } else {
      if (isTyping) {
        sendMessage();
      } else {
        closeInput();
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (val.trim().length > 0 && !isTyping) {
      setIsTyping(true);
    } else if (val.trim().length === 0 && isTyping) {
      setIsTyping(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isTyping) {
      sendMessage();
    }
  };

  const openHistory = () => {
    setIsHistoryOpen(true);
  };

  const closeHistory = () => {
    setIsHistoryOpen(false);
  };

  const startNewChat = () => {
    setMessages([]);
    setActiveSessionId(null);
    if (isInputOpen) closeInput();
    if (isRecording) stopRecording();
    setTitleContent(getDefaultGreeting());
  };

  const handleHistoryItemClick = (session: ChatSession) => {
    setMessages(session.messages);
    setActiveSessionId(session.id);
    if (!isInputOpen) openInput();
    if (isRecording) stopRecording();
    setTitleContent(<span className="text-[#2d2d2d]">{session.title}</span>);
    closeHistory();
  };

  const isBlurred = isInputOpen || isHistoryOpen;
  
  return (
    <div className="app-container">
      <WebGLBackground blurred={isBlurred} />
      <div className="fade-overlay"></div>

      {/* Top Navigation */}
      <div className={`absolute top-8 md:top-12 left-0 w-full px-6 md:px-12 max-w-screen-2xl mx-auto flex justify-between items-center z-40 transition-opacity duration-300 ${isRecording ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}>
        <button onClick={() => !isHistoryOpen && openHistory()} className="p-2 text-[#2d2d2d] hover:opacity-60 transition-opacity cursor-pointer">
          <svg className="w-6 h-6 md:w-7 md:h-7" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
            <g clipPath="url(#clip0_4418_3668)">
              <path d="M16.42 7.94923C18.86 10.3892 18.86 14.3492 16.42 16.7892C13.98 19.2292 10.02 19.2292 7.58 16.7892C5.14 14.3492 5.14 10.3892 7.58 7.94923C8.95 6.57923 10.81 5.97924 12.6 6.14924" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8.24999 21.6409C6.24999 20.8409 4.49999 19.3909 3.33999 17.3809C2.19999 15.4109 1.81999 13.2209 2.08999 11.1309" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.8501 4.47937C7.5501 3.14937 9.68009 2.35938 12.0001 2.35938C14.2701 2.35938 16.3601 3.12936 18.0401 4.40936" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15.75 21.6409C17.75 20.8409 19.5 19.3909 20.66 17.3809C21.8 15.4109 22.18 13.2209 21.91 11.1309" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <defs>
              <clipPath id="clip0_4418_3668">
                <rect width="24" height="24" fill="white"/>
              </clipPath>
            </defs>
          </svg>
        </button>

        <div className="absolute left-1/2 transform -translate-x-1/2 text-xl font-bold tracking-widest text-[#2d2d2d] uppercase">
          Whale
        </div>

        <button onClick={() => isHistoryOpen ? closeHistory() : startNewChat()} className="relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-[#2d2d2d] hover:opacity-60 transition-opacity cursor-pointer">
          <svg className={`w-6 h-6 md:w-7 md:h-7 absolute transition-all duration-300 transform ${isHistoryOpen ? 'scale-50 opacity-0' : 'scale-100 opacity-100'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
            <g clipPath="url(#clip0_4418_3451)">
              <path d="M18.0203 4.8604C16.8203 3.6604 15.1703 3.72042 14.3603 5.01042L12.5903 7.81041L18.2603 13.4804L21.0603 11.7104C22.2703 10.9504 22.3403 9.1804 21.2003 8.0504" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11.2901 21.4797L7.02011 21.9797C5.18011 22.1897 3.86011 20.8698 4.08011 19.0398L5.06011 10.7598" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.2502 13.4707L18.4902 17.5907C18.7202 19.8907 17.9202 20.6907 15.7402 20.9507" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12.5801 7.81116L10.8301 7.70117" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.28027 20.7799L8.46028 17.5898" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11 6.5C11 6.91 10.94 7.32001 10.83 7.70001C10.72 8.10001 10.56 8.47001 10.35 8.82001C10.11 9.22001 9.81001 9.58 9.46001 9.88C8.67001 10.58 7.64 11 6.5 11C5.99 11 5.51 10.92 5.06 10.76C4.04 10.42 3.18999 9.72001 2.64999 8.82001C2.23999 8.14001 2 7.34 2 6.5C2 5.08 2.65 3.80999 3.69 2.98999C4.46 2.36999 5.44 2 6.5 2C8.99 2 11 4.01 11 6.5Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6.52002 8.1803V4.82031" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8.15981 6.5H4.7998" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <defs>
              <clipPath id="clip0_4418_3451">
                <rect width="24" height="24" fill="white"/>
              </clipPath>
            </defs>
          </svg>
          <svg className={`w-6 h-6 md:w-7 md:h-7 absolute transition-all duration-300 transform ${isHistoryOpen ? 'scale-100 opacity-100 rotate-0' : 'scale-50 opacity-0 -rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <div className="content-layer p-6 md:p-12 pb-8 md:pb-12 max-w-screen-2xl mx-auto h-full flex flex-col justify-between">
        
        {/* Dynamic Messages Area */}
        <div className={`messages-container flex-1 flex flex-col gap-3 w-full max-w-4xl mx-auto mt-20 md:mt-24 overflow-y-auto transition-opacity duration-500 z-20 pr-2 ${isInputOpen && !isHistoryOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          {messages.map((msg, idx) => {
            const isLast = idx === messages.length - 1;
            const isModel = msg.role === 'model';
            
            return (
              <div key={idx} className={`${!isModel ? 'self-end bg-[#2d2d2d] text-white rounded-br-sm origin-bottom-right px-5 py-3 md:px-6 md:py-4 rounded-2xl shadow-sm max-w-[90%] md:max-w-[85%]' : 'self-start bg-transparent text-[#2d2d2d] origin-bottom-left py-2 max-w-full md:max-w-[85%]'} text-[15px] md:text-[17px] transform transition-all duration-300 animate-in fade-in zoom-in`}>
                {!isModel ? (
                  <div>{msg.text}</div>
                ) : (
                  <div className={`prose prose-sm md:prose-base dark:prose-invert max-w-none text-[#2d2d2d] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${isLast && isGenerating ? 'opacity-90' : ''}`}>
                    {msg.text === '' && isLast && isGenerating ? (
                      <span className="animate-shimmer font-medium text-lg">Thinking...</span>
                    ) : (
                      <>
                        <ReactMarkdown
                          components={{
                            pre({ children, ...props }) {
                              return (
                                <div className="relative group rounded-xl overflow-hidden bg-[#f4f3ed] border border-[#e6e5df] my-4">
                                  <div className="flex justify-between items-center px-4 py-2 bg-[#e6e5df] text-[#888888] text-xs font-medium uppercase tracking-wider">
                                    <span>Code</span>
                                    <button 
                                      onClick={(e) => {
                                        const codeEl = (e.currentTarget.parentElement?.nextElementSibling as HTMLElement)?.innerText;
                                        if (codeEl) navigator.clipboard.writeText(codeEl);
                                        
                                        const btn = e.currentTarget;
                                        const oldText = btn.innerText;
                                        btn.innerText = 'Copied!';
                                        setTimeout(() => btn.innerText = oldText, 2000);
                                      }}
                                      className="hover:text-[#2d2d2d] transition-colors cursor-pointer"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                  <pre className="p-4 overflow-x-auto text-sm text-[#2d2d2d] m-0 bg-transparent" {...props}>
                                    {children}
                                  </pre>
                                </div>
                              );
                            }
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                        {msg.responseTimeMs && (
                          <div className="text-[11px] text-[#888888] mt-2 font-mono opacity-60">
                            Generated in {(msg.responseTimeMs / 1000).toFixed(1)}s
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Content Area */}
        <div className="mt-auto relative z-20 w-full max-w-4xl mx-auto flex flex-col justify-end">
          {/* Main Title */}
          <div className={`transition-all duration-500 overflow-hidden ${isInputOpen || messages.length > 0 ? 'opacity-0 h-0 mb-0' : 'opacity-100 mb-10 md:mb-16'}`}>
            <h1 className="text-[32px] sm:text-[48px] md:text-[56px] lg:text-[72px] leading-[1.1] font-bold text-[#2d2d2d] tracking-tight" style={{ filter: isBlurred ? 'blur(6px)' : 'none' }}>
              {titleContent}
            </h1>
          </div>

          {/* Action Bar Container */}
          <div className={`relative w-full h-12 md:h-14 flex items-center justify-between transition-all duration-500 ${isHistoryOpen ? 'opacity-0 pointer-events-none' : ''}`}>
            
            {/* Mic Button */}
            <button onClick={toggleRecording} className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center hover:bg-black/5 rounded-full transition-all duration-300 z-10 cursor-pointer relative overflow-hidden ${isInputOpen ? 'opacity-0 scale-75 pointer-events-none' : ''}`}>
              {/* Normal Mic */}
              <svg className={`w-6 h-6 md:w-7 md:h-7 text-[#7a7a7a] absolute transition-all duration-300 transform ${isRecording ? 'scale-50 opacity-0' : 'scale-100 opacity-100'}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5.5c0 3.23 2.38 5.93 5.5 6.43V21h2v-3.57c3.12-.5 5.5-3.2 5.5-6.43h-1.5z"/>
              </svg>

              {/* Stop Square */}
              <div className={`w-4 h-4 md:w-5 md:h-5 bg-red-500 absolute transition-all duration-300 transform rounded-sm ${isRecording ? 'scale-100 opacity-100 animate-stop' : 'scale-50 opacity-0'}`}></div>
              
              {/* Recording Ring */}
              <div className={`absolute inset-0 rounded-full border-2 border-red-500 transition-all duration-300 ${isRecording ? 'opacity-100 scale-100 animate-pulse' : 'opacity-0 scale-150'}`}></div>
            </button>

            {/* Floating Expanding Input Bar */}
            <div className="absolute right-0 top-0 h-12 md:h-14 bg-white/90 backdrop-blur-xl rounded-full flex items-center overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_4px_20px_rgba(0,0,0,0.08)] z-20 border border-white/50 max-w-full md:max-w-2xl" style={{ width: isInputOpen ? '100%' : '48px', opacity: isInputOpen ? 1 : 0, pointerEvents: isInputOpen ? 'auto' : 'none' }}>
              <input 
                ref={inputRef}
                type="text" 
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                className={`w-full h-full bg-transparent outline-none pl-5 md:pl-6 pr-14 md:pr-16 text-[15px] md:text-[17px] text-[#2d2d2d] placeholder-gray-400 font-medium transition-opacity duration-300 delay-100 ${isInputOpen ? 'opacity-100' : 'opacity-0'}`} 
                placeholder="Type a message..." 
                autoComplete="off" 
              />
            </div>

            {/* Multi-state Action Button */}
            <button onClick={handleActionClick} className="absolute right-0 top-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center hover:bg-black/5 rounded-full transition-colors z-30 cursor-pointer">
              
              {/* Grid Icon */}
              <svg className={`w-6 h-6 md:w-7 md:h-7 text-[#7a7a7a] absolute transition-all duration-300 transform ${!isInputOpen ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
                <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
                <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
                <rect x="16.25" y="13.5" width="2" height="7.5" rx="1" />
                <rect x="13.5" y="16.25" width="7.5" height="2" rx="1" />
              </svg>

              {/* Close (X) Icon */}
              <svg className={`w-6 h-6 md:w-7 md:h-7 text-[#2d2d2d] absolute transition-all duration-300 transform ${isInputOpen && !isTyping ? 'scale-100 opacity-100 rotate-0' : 'scale-50 opacity-0 -rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>

              {/* Send Icon */}
              <svg className={`w-5 h-5 md:w-6 md:h-6 text-[#2d2d2d] absolute transition-all duration-300 transform ${isInputOpen && isTyping ? 'scale-100 opacity-100 translate-y-0' : 'scale-50 opacity-0 translate-y-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>

          </div>
        </div>
      </div>

      {/* History Overlay */}
      <div className={`absolute inset-0 z-30 transition-all duration-500 flex flex-col pt-24 md:pt-32 px-6 md:px-12 pb-6 md:pb-12 ${isHistoryOpen ? 'opacity-100 pointer-events-auto backdrop-blur-md bg-[#e6e5df]/40' : 'opacity-0 pointer-events-none bg-transparent'}`}>
        <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
          <h2 className="text-lg md:text-2xl font-semibold tracking-tight text-[#2d2d2d] mb-6 px-1">Chat History</h2>
          
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 no-scrollbar">
            {historySessions.length === 0 && (
              <div className="text-[#888888] px-1">No past conversations yet.</div>
            )}
            {historySessions.map((session) => (
              <div key={session.id} onClick={() => handleHistoryItemClick(session)} className="history-item w-full text-left bg-[#2d2d2d] text-white px-5 py-3 md:px-6 md:py-4 text-[15px] md:text-[17px] rounded-2xl shadow-sm cursor-pointer hover:bg-black transition-colors transform active:scale-95">
                {session.title}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
