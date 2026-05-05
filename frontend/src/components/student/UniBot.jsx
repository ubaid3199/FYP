import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Minus, Send, Plus, Sparkles } from 'lucide-react';

const UniBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // 1. Initialize State from LocalStorage (or create default Main Chat)
  const [chats, setChats] = useState(() => {
    const savedChats = localStorage.getItem('unibot_chats');
    if (savedChats) return JSON.parse(savedChats);
    return [{ id: 1, title: 'Main Chat', isMain: true, messages: [] }];
  });

  const [activeTabId, setActiveTabId] = useState(() => {
    const savedTab = localStorage.getItem('unibot_active_tab');
    return savedTab ? parseInt(savedTab, 10) : 1;
  });

  // 2. Save to LocalStorage whenever chats or tabs change
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

  // Auto-scroll to the bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats, isTyping, activeTabId]);

  // Handle Deleting a Chat
  const handleDeleteChat = (e, chatId) => {
    e.stopPropagation(); // Prevents the tab from clicking "active" when you click the X
    
    // The warning prompt you requested
    if (window.confirm("Are you sure? Clearing this chat tab means you will lose your chat data for this session.")) {
      setChats(prev => prev.filter(c => c.id !== chatId));
      // If they closed the tab they were currently looking at, switch back to Main Chat
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

    // Instantly display user's message
    const newMessage = { id: Date.now(), text, sender: 'user' };
    setChats(prevChats => prevChats.map(chat => 
      chat.id === activeTabId 
        ? { ...chat, messages: [...chat.messages, newMessage] } 
        : chat
    ));
    setInputValue('');
    setIsTyping(true);

    try {
      // 🔥 THE SYSTEM LINK: Read global settings set by Admin
      const activeModel = localStorage.getItem('unibot_global_model') || 'gpt-oss 2b';
      const isRestricted = localStorage.getItem('unibot_global_restricted') !== 'false';

      // ========================================================
      // 🔌 FUTURE LOCAL AI INTEGRATION (Ollama)
      // ========================================================
      /*
      // When connecting to your friend's backend, your payload will look like this:
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...chats.find(c => c.id === activeTabId).messages, newMessage],
          userId: 'student_123', // get from your AuthContext
          isRestricted: isRestricted, // Admin toggle!
          model: activeModel          // Admin model!
        })
      });
      // ... parse stream/JSON ...
      */

      // --- SIMULATED RESPONSE PROVING GLOBAL CONTROL ---
      const aiText = await new Promise((resolve) => 
        setTimeout(() => resolve(`I am processing your request. \n\n(Dev Note: I am secretly running on the admin's chosen model [${activeModel}] and my data source is currently [${isRestricted ? 'Restricted to Uni Data' : 'Unrestricted External Access'}])`), 1500)
      );

      // Display AI's response
      const botResponse = { 
        id: Date.now() + 1, 
        text: aiText, 
        sender: 'bot' 
      };
      
      setChats(prevChats => prevChats.map(chat => 
        chat.id === activeTabId 
          ? { ...chat, messages: [...chat.messages, botResponse] } 
          : chat
      ));

    } catch (error) {
      console.error("AI Model Error:", error);
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
        className={`fixed bottom-6 right-6 w-14 h-14 bg-[#0B4C3A] text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 z-50 group ${isOpen ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}
      >
        <div className="absolute inset-0 rounded-full bg-emerald-400 opacity-20 group-hover:animate-ping"></div>
        <MessageSquare size={24} />
      </button>

      {/* CHAT WINDOW */}
      <div 
        className={`fixed bottom-6 right-6 w-[22rem] sm:w-96 h-[32rem] sm:h-[36rem] z-50 flex flex-col rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/40 bg-white/70 backdrop-blur-xl transition-all duration-400 ease-out origin-bottom-right ${
          isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95 pointer-events-none'
        }`}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/50 bg-white/50 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0B4C3A] to-emerald-700 flex items-center justify-center text-white shadow-sm">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 leading-tight">UniBot</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <button onClick={() => setIsOpen(false)} className="hover:text-gray-700 hover:bg-gray-100/50 p-1.5 rounded-lg transition-colors">
              <Minus size={18} />
            </button>
            <button onClick={() => setIsOpen(false)} className="hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* TAB SYSTEM (Made Bigger & Added Delete functionality) */}
        <div className="flex items-center px-3 py-2.5 border-b border-gray-200/50 overflow-x-auto scrollbar-hide bg-white/30">
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => setActiveTabId(chat.id)}
              className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 mr-2 border shadow-sm ${
                activeTabId === chat.id 
                  ? 'bg-[#0B4C3A] text-white border-[#0B4C3A]' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              <span>{chat.title}</span>
              
              {/* Only show the 'X' if it is NOT the Main Chat */}
              {!chat.isMain && (
                <span 
                  onClick={(e) => handleDeleteChat(e, chat.id)}
                  className={`p-0.5 rounded-full transition-colors ${
                    activeTabId === chat.id ? 'hover:bg-red-500 hover:text-white text-emerald-200' : 'hover:bg-red-100 hover:text-red-600 text-gray-400'
                  }`}
                >
                  <X size={14} />
                </span>
              )}
            </button>
          ))}
          
          <button 
            onClick={createNewChat}
            className="p-2 rounded-full bg-white border border-gray-200 shadow-sm text-gray-400 hover:text-[#0B4C3A] hover:bg-emerald-50 hover:border-emerald-200 transition-colors shrink-0 ml-1"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* MESSAGE AREA */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 scrollbar-hide">
          
          {/* Welcome Prompts */}
          {activeChat?.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-[#0B4C3A] mb-4">
                <MessageSquare size={24} />
              </div>
              <h4 className="text-gray-800 font-bold mb-1">How can I help today?</h4>
              <p className="text-sm text-gray-500 mb-6">Ask me anything about your university experience.</p>
              
              <div className="flex flex-wrap justify-center gap-2">
                {quickPrompts.map((prompt, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="bg-white border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 hover:text-[#0B4C3A] transition-all shadow-sm"
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
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                msg.sender === 'user' ? 'bg-[#0B4C3A] text-white rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex w-full justify-start animate-in fade-in duration-300">
              <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="p-4 bg-white/80 border-t border-gray-200/50 rounded-b-3xl backdrop-blur-md">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
              placeholder="Ask UniBot anything..."
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-full pl-4 pr-12 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
            />
            <button
              onClick={() => handleSendMessage(inputValue)}
              disabled={!inputValue.trim()}
              className="absolute right-2 p-2 bg-[#0B4C3A] text-white rounded-full hover:bg-emerald-800 disabled:opacity-50 disabled:hover:bg-[#0B4C3A] transition-colors"
            >
              <Send size={14} className="ml-0.5" />
            </button>
          </div>
        </div>

      </div>
    </>
  );
};

export default UniBot;