import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Minus, Send, Plus, Sparkles } from 'lucide-react';
import api from '../../api/axios';

const UniBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // 1. Initialize State from LocalStorage
  const [chats, setChats] = useState(() => {
    const savedChats = localStorage.getItem('unibot_chats');
    if (savedChats) return JSON.parse(savedChats);
    return [{ id: 1, title: 'Main Chat', isMain: true, messages: [] }];
  });

  const [activeTabId, setActiveTabId] = useState(() => {
    const savedTab = localStorage.getItem('unibot_active_tab');
    return savedTab ? parseInt(savedTab, 10) : 1;
  });

  // 2. Save to LocalStorage
  useEffect(() => {
    localStorage.setItem('unibot_chats', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    localStorage.setItem('unibot_active_tab', activeTabId.toString());
  }, [activeTabId]);

  const quickPrompts = [
    "Check my timetable",
    "Deadlines this week",
    "Contact lecturer",
    "Library opening hours"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats, isTyping, activeTabId]);

  const handleDeleteChat = (e, chatId) => {
    e.stopPropagation(); 
    if (window.confirm("Are you sure? Clearing this chat tab means you will lose your chat data for this session.")) {
      setChats(prev => prev.filter(c => c.id !== chatId));
      if (activeTabId === chatId) {
        setActiveTabId(1);
      }
    }
  };

  const createNewChat = () => {
    const newId = Date.now();
    setChats([...chats, { id: newId, title: `Chat ${chats.length}`, isMain: false, messages: [] }]);
    setActiveTabId(newId);
  };

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    const newMessage = { id: Date.now(), text, sender: 'user' };
    setChats(prevChats => prevChats.map(chat => 
      chat.id === activeTabId 
        ? { ...chat, messages: [...chat.messages, newMessage] } 
        : chat
    ));
    setInputValue('');
    setIsTyping(true);

    try {
      const activeModel = 'gpt-oss:20b'; 
      const currentChat = chats.find(c => c.id === activeTabId);
      
      const ollamaMessages = [...currentChat.messages, newMessage].map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      const response = await api.post('/assistant/chat', {
        model: activeModel,
        messages: ollamaMessages,
        isRestricted: true,
      });

      const aiText = response.data?.message?.content;
      if (!aiText) throw new Error('Empty AI response');

      const botResponse = { id: Date.now() + 1, text: aiText, sender: 'bot' };
      setChats(prevChats => prevChats.map(chat => 
        chat.id === activeTabId ? { ...chat, messages: [...chat.messages, botResponse] } : chat
      ));

    } catch (error) {
      console.error("AI Model Error:", error);
      const errorResponse = { id: Date.now() + 1, text: "Error connecting to the AI. Is the model running?", sender: 'bot' };
      setChats(prevChats => prevChats.map(chat => 
        chat.id === activeTabId ? { ...chat, messages: [...chat.messages, errorResponse] } : chat
      ));
    } finally {
      setIsTyping(false);
    }
  };
  
  const activeChat = chats.find(c => c.id === activeTabId);

  return (
    <>
      {/* FLOATING ACTION BUTTON */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-8 right-8 w-16 h-16 bg-[#0B4C3A] text-white rounded-full flex items-center justify-center shadow-2xl hover:shadow-emerald-900/50 hover:scale-105 transition-all duration-300 z-50 group ${isOpen ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}
      >
        <div className="absolute inset-0 rounded-full bg-emerald-400 opacity-20 group-hover:animate-ping"></div>
        <MessageSquare size={28} />
      </button>

      {/* CHAT WINDOW - MADE BIGGER & BORDERLESS */}
      <div 
        className={`fixed bottom-8 right-8 w-[24rem] sm:w-[28rem] h-[38rem] sm:h-[42rem] z-50 flex flex-col rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] bg-white/70 backdrop-blur-2xl transition-all duration-400 ease-out origin-bottom-right overflow-hidden ${
          isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95 pointer-events-none'
        }`}
      >
        {/* HEADER - BORDERLESS */}
        <div className="flex items-center justify-between px-6 py-5 bg-white/40">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0B4C3A] to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/20">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg leading-tight">UniBot</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <button onClick={() => setIsOpen(false)} className="hover:text-gray-700 hover:bg-black/5 p-2 rounded-xl transition-colors">
              <Minus size={20} />
            </button>
            <button onClick={() => setIsOpen(false)} className="hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* TAB SYSTEM - BORDERLESS */}
        <div className="flex items-center px-4 py-3 overflow-x-auto scrollbar-hide bg-white/20 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] z-10">
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => setActiveTabId(chat.id)}
              className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 text-[15px] font-semibold rounded-2xl transition-all duration-200 mr-2 ${
                activeTabId === chat.id 
                  ? 'bg-[#0B4C3A] text-white shadow-lg shadow-emerald-900/20' 
                  : 'bg-transparent text-gray-500 hover:bg-black/5'
              }`}
            >
              <span>{chat.title}</span>
              
              {!chat.isMain && (
                <span 
                  onClick={(e) => handleDeleteChat(e, chat.id)}
                  className={`p-1 rounded-full transition-colors ${
                    activeTabId === chat.id ? 'hover:bg-red-500/80 hover:text-white text-emerald-200' : 'hover:bg-red-100 hover:text-red-600 text-gray-400'
                  }`}
                >
                  <X size={14} />
                </span>
              )}
            </button>
          ))}
          
          <button 
            onClick={createNewChat}
            className="p-2.5 rounded-full bg-black/5 text-gray-500 hover:text-[#0B4C3A] hover:bg-emerald-50 transition-colors shrink-0 ml-1"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* MESSAGE AREA */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 scrollbar-hide bg-gradient-to-b from-transparent to-white/30">
          
          {/* Welcome Prompts */}
          {activeChat?.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-14 h-14 bg-white shadow-xl shadow-emerald-900/5 rounded-3xl flex items-center justify-center text-[#0B4C3A] mb-5">
                <MessageSquare size={28} />
              </div>
              <h4 className="text-gray-800 text-lg font-bold mb-1">How can I help today?</h4>
              <p className="text-base text-gray-500 mb-8">Ask me anything about your university experience.</p>
              
              <div className="flex flex-wrap justify-center gap-3">
                {quickPrompts.map((prompt, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="bg-white/80 backdrop-blur-sm text-gray-700 text-sm font-semibold px-4 py-2.5 rounded-2xl hover:bg-white hover:text-[#0B4C3A] hover:shadow-md transition-all shadow-sm"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actual Messages */}
          {activeChat?.messages.map((msg) => (
            <div key={msg.id} className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-5 py-3.5 rounded-3xl text-[15px] leading-relaxed shadow-sm ${
                msg.sender === 'user' ? 'bg-[#0B4C3A] text-white rounded-tr-sm shadow-emerald-900/20' : 'bg-white text-gray-800 rounded-tl-sm shadow-gray-200/50'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex w-full justify-start animate-in fade-in duration-300">
              <div className="bg-white px-5 py-4 rounded-3xl rounded-tl-sm shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA - BORDERLESS */}
        <div className="p-5 bg-white/60 backdrop-blur-xl">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
              placeholder="Ask UniBot anything..."
              className="w-full bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] text-gray-800 text-[15px] rounded-full pl-6 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-[#0B4C3A]/30 transition-all placeholder:text-gray-400"
            />
            <button
              onClick={() => handleSendMessage(inputValue)}
              disabled={!inputValue.trim()}
              className="absolute right-2 p-3 bg-[#0B4C3A] text-white rounded-full shadow-md hover:bg-emerald-800 disabled:opacity-0 disabled:scale-75 transition-all duration-200"
            >
              <Send size={18} className="ml-0.5" />
            </button>
          </div>
        </div>

      </div>
    </>
  );
};

export default UniBot;