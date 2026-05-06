import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Minus, Send, Plus, Shield, Globe, ShieldAlert, ChevronDown, UploadCloud, FileText, CheckCircle2 } from 'lucide-react';
import api from '../../api/axios';

export default function AdminUniBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // --- ADMIN GLOBAL CONTROLS ---
  const [activeModel, setActiveModel] = useState(() => localStorage.getItem('unibot_global_model') || 'gpt-oss:20b');
  const [isRestricted, setIsRestricted] = useState(() => localStorage.getItem('unibot_global_restricted') !== 'false');

  // Custom Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const availableModels = [
    { id: 'gpt-oss:20b', label: 'gpt-oss:20b' },
    { id: 'gemma3:latest', label: 'gemma3:latest' },
    { id: 'gemma3:1b', label: 'gemma3:1b (Fast)' }
  ];

  // File Upload State (RAG Training)
  const [isUploading, setIsUploading] = useState(false);
  const [trainedFiles, setTrainedFiles] = useState([
    { name: "Student_Handbook_2026.pdf", size: "2.4 MB" } // Mock initial data
  ]);

  useEffect(() => {
    localStorage.setItem('unibot_global_model', activeModel);
    localStorage.setItem('unibot_global_restricted', isRestricted.toString());
  }, [activeModel, isRestricted]);

  // --- LIVE TESTING CHAT STATE ---
  const [chats, setChats] = useState([{ id: 1, title: 'Test 1', messages: [] }]);
  const [activeTabId, setActiveTabId] = useState(1);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => scrollToBottom(), [chats, isTyping, activeTabId]);

  const createNewChat = () => {
    const newId = Date.now();
    setChats([...chats, { id: newId, title: `Test ${chats.length + 1}`, messages: [] }]);
    setActiveTabId(newId);
  };

  const handleDeleteChat = (e, chatId) => {
    e.stopPropagation();
    if (chats.length === 1) {
      alert("You must keep at least one test session open.");
      return;
    }
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeTabId === chatId) {
      setActiveTabId(chats.find(c => c.id !== chatId).id);
    }
  };

  // Simulated File Upload Handler
  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    
    // Simulate server processing & embedding time
    setTimeout(() => {
      const newFiles = Array.from(files).map(f => ({
        name: f.name,
        size: (f.size / 1024 / 1024).toFixed(2) + " MB"
      }));
      setTrainedFiles(prev => [...newFiles, ...prev]);
      setIsUploading(false);
    }, 2000);
  };

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    const newMessage = { id: Date.now(), text, sender: 'user' };
    setChats(prev => prev.map(chat => chat.id === activeTabId ? { ...chat, messages: [...chat.messages, newMessage] } : chat));
    setInputValue('');
    setIsTyping(true);

    try {
      const activeChat = chats.find(c => c.id === activeTabId);
      const history = (activeChat?.messages || []).concat([newMessage]).map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text,
      }));

      const response = await api.post('/assistant/chat', {
        model: activeModel,
        messages: history,
        isRestricted,
      });

      const aiText = response.data?.message?.content;
      if (!aiText) throw new Error('Empty AI response');

      const botResponse = { id: Date.now() + 1, text: aiText, sender: 'bot' };
      setChats(prev => prev.map(chat => chat.id === activeTabId ? { ...chat, messages: [...chat.messages, botResponse] } : chat));
    } catch (error) {
      console.error("Test Model Error:", error);
      const errorText = error?.response?.data?.message || 'Error connecting to the AI. Is the model running?';
      const botResponse = { id: Date.now() + 1, text: errorText, sender: 'bot' };
      setChats(prev => prev.map(chat => chat.id === activeTabId ? { ...chat, messages: [...chat.messages, botResponse] } : chat));
    } finally {
      setIsTyping(false);
    }
  };

  const activeChat = chats.find(c => c.id === activeTabId);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-4 sm:right-6 w-14 h-14 bg-[#0B4C3A] text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 z-50 group ${isOpen ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}
      >
        <Bot size={26} className="group-hover:animate-pulse" />
      </button>

      <div 
        className={`fixed bottom-6 right-4 sm:right-6 w-[calc(100vw-2rem)] max-w-[28rem] sm:max-w-none sm:w-[28rem] h-[44rem] max-h-[calc(100vh-6rem)] z-50 flex flex-col rounded-3xl shadow-[0_10px_40px_rgb(0,0,0,0.2)] border border-gray-200/50 bg-white/80 backdrop-blur-2xl transition-all duration-400 ease-out origin-bottom-right ${
          isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95 pointer-events-none'
        }`}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-white/60 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#0B4C3A] flex items-center justify-center text-white shadow-sm">
              <Bot size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 leading-tight">UniBot Core (Admin)</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">System Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <button onClick={() => setIsOpen(false)} className="hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"><Minus size={18} /></button>
            <button onClick={() => setIsOpen(false)} className="hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"><X size={18} /></button>
          </div>
        </div>

        {/* 🎛️ ADMIN CONFIGURATION PANEL */}
        <div className="bg-gray-50/80 px-5 py-5 border-b border-gray-200 backdrop-blur-sm overflow-y-auto max-h-64 scrollbar-thin">
          
          {/* Custom Modern Dropdown */}
          <div className="mb-5 relative z-20">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Active AI Engine</label>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
              className="w-full bg-white border border-gray-200 text-gray-800 text-sm font-semibold rounded-xl px-4 py-3 flex justify-between items-center shadow-sm hover:border-[#0B4C3A]/50 hover:bg-emerald-50/20 transition-all"
            >
              {availableModels.find(m => m.id === activeModel)?.label}
              <ChevronDown size={18} className={`text-gray-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-[#0B4C3A]' : ''}`} />
            </button>
            
            {isDropdownOpen && (
              <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                {availableModels.map(model => (
                  <div
                    key={model.id}
                    onClick={() => { setActiveModel(model.id); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-3 text-sm cursor-pointer transition-colors ${activeModel === model.id ? 'bg-emerald-50 font-bold text-[#0B4C3A]' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {model.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Toggle Switch */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                {isRestricted ? <Shield size={16} className="text-[#0B4C3A]" /> : <Globe size={16} className="text-orange-500" />}
                Restrict Data Source
              </h4>
              <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                {isRestricted ? "ON: Answers restricted to trained knowledge base." : "OFF: Model can use general internet knowledge."}
              </p>
            </div>
            <button 
              onClick={() => setIsRestricted(!isRestricted)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isRestricted ? 'bg-[#0B4C3A]' : 'bg-gray-300'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isRestricted ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* 🔥 KNOWLEDGE BASE UPLOAD (RAG) */}
          <div className="pt-4 border-t border-gray-200/70">
             <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Feed Knowledge Base</label>
             
             {/* Drag & Drop Zone */}
             <div className={`relative border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer overflow-hidden ${isUploading ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-300 bg-white hover:border-[#0B4C3A] hover:bg-emerald-50/20'}`}>
                <input type="file" multiple onChange={handleFileUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed" />
                
                {isUploading ? (
                  <div className="flex flex-col items-center justify-center space-y-2 py-1">
                     <div className="w-5 h-5 border-2 border-[#0B4C3A] border-t-transparent rounded-full animate-spin"></div>
                     <span className="text-xs text-[#0B4C3A] font-bold">Vectorizing & Embedding...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-1.5 py-1">
                     <UploadCloud size={24} className="text-gray-400" />
                     <span className="text-sm font-semibold text-gray-700">Click or drag files to train model</span>
                     <span className="text-[10px] text-gray-400">Supports .PDF, .TXT, .DOCX</span>
                  </div>
                )}
             </div>

             {/* List of Embedded Files */}
             {trainedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                   {trainedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 bg-white border border-gray-100 p-2 rounded-lg shadow-sm">
                         <FileText size={14} className="text-[#0B4C3A]" />
                         <div className="flex-1 min-w-0">
                           <p className="text-xs font-semibold text-gray-700 truncate">{file.name}</p>
                           <p className="text-[9px] text-gray-400">{file.size} • Embedded</p>
                         </div>
                         <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      </div>
                   ))}
                </div>
             )}
          </div>
        </div>

        {/* TAB SYSTEM */}
        <div className="flex items-center px-3 py-2 bg-gray-100/50 border-b border-gray-200">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-3 ml-2">Live Tests</span>
          <div className="flex flex-1 overflow-x-auto scrollbar-hide">
            {chats.map(chat => (
              <div
                key={chat.id}
                onClick={() => setActiveTabId(chat.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 mr-2 border cursor-pointer ${
                  activeTabId === chat.id 
                    ? 'bg-[#0B4C3A] text-white border-[#0B4C3A]' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {chat.title}
                <span 
                  onClick={(e) => handleDeleteChat(e, chat.id)}
                  className={`p-0.5 rounded-full transition-colors ml-1 ${activeTabId === chat.id ? 'hover:bg-red-500 hover:text-white text-emerald-200' : 'hover:bg-red-100 hover:text-red-500 text-gray-400'}`}
                >
                  <X size={12} />
                </span>
              </div>
            ))}
          </div>
          <button onClick={createNewChat} className="p-1.5 rounded-md bg-white border border-gray-200 text-gray-500 hover:text-[#0B4C3A] hover:border-emerald-200 hover:bg-emerald-50 shadow-sm ml-1 shrink-0 transition-colors">
            <Plus size={14} />
          </button>
        </div>

        {/* MESSAGE AREA */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 scrollbar-hide bg-white/30">
          {activeChat?.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
              <ShieldAlert size={32} className="mb-2 text-gray-400" />
              <p className="text-sm font-semibold text-gray-600">Test Engine is Ready</p>
              <p className="text-xs text-gray-500 mt-1">Changes to model & data apply instantly.</p>
            </div>
          )}

          {activeChat?.messages.map((msg) => (
            <div key={msg.id} className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                msg.sender === 'user' ? 'bg-[#0B4C3A] text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex w-full justify-start">
              <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="p-4 bg-white/90 border-t border-gray-200 rounded-b-3xl">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
              placeholder="Query the model..."
              className="w-full bg-gray-50 border border-gray-300 text-gray-800 text-sm rounded-full pl-4 pr-12 py-3 outline-none focus:border-[#0B4C3A] focus:ring-1 focus:ring-[#0B4C3A] transition-all"
            />
            <button
              onClick={() => handleSendMessage(inputValue)}
              disabled={!inputValue.trim()}
              className="absolute right-2 p-2 bg-[#0B4C3A] text-white rounded-full hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              <Send size={14} className="ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}