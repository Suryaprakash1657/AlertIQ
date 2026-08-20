import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User, Terminal, Database, Loader2 } from "lucide-react";
import { mockDocuments } from "../../data/mockDocuments";

export default function FollowUpChat({ alertId, followUpResponses, retrievedSources }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const chips = [
    "Why was this source selected?",
    "Show more context",
    "What evidence supports this recommendation?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = (text) => {
    if (!text.trim() || isTyping) return;

    // 1. Add User Message
    const userMsg = {
      id: Date.now(),
      sender: "user",
      text: text
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    // 2. Simulate AI response
    setTimeout(() => {
      // Find matches in pre-canned responses
      let replyText = "";
      if (followUpResponses && followUpResponses[text]) {
        replyText = followUpResponses[text];
      } else {
        // Build general smart response
        replyText = `Regarding your query "${text}": The index contains documents recommending immediate host isolation. In secondary runbooks, credential revocation is recommended to mitigate active credentials misuse before host reactivation.`;
      }

      // Attach relevant citations
      const citations = retrievedSources && retrievedSources.length > 0 
        ? retrievedSources.slice(0, 2).map(id => mockDocuments.find(d => d.id === id)).filter(Boolean)
        : [];

      const aiMsg = {
        id: Date.now() + 1,
        sender: "assistant",
        text: replyText,
        citations: citations
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1400);
  };

  return (
    <div className="glass-panel rounded-xl overflow-hidden flex flex-col border border-slate-800">
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-rose-500" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Interactive Follow-Up Session
          </h3>
        </div>
        <span className="text-[9px] text-slate-500 font-mono">
          RAG Chat Context Locked
        </span>
      </div>

      {/* Messages list */}
      <div className="p-5 flex-1 overflow-y-auto space-y-4 min-h-[220px] max-h-[360px] bg-slate-950/20">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
            <span className="text-slate-500 text-xs">No active dialogue yet.</span>
            <p className="text-[10px] text-slate-600 max-w-xs leading-relaxed">
              Ask questions to explore matches in incident databases.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div 
              key={m.id} 
              className={`flex items-start gap-3 ${
                m.sender === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar Icon */}
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${
                m.sender === "user" 
                  ? "bg-slate-850 border-slate-750 text-slate-300"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-500"
              }`}>
                {m.sender === "user" ? <User size={14} /> : <Terminal size={14} />}
              </div>

              {/* Chat Message Bubble */}
              <div className="max-w-[75%] space-y-2">
                <div className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                  m.sender === "user"
                    ? "bg-slate-800 text-slate-100 rounded-tr-none"
                    : "bg-slate-900 border border-slate-850 text-slate-200 rounded-tl-none"
                }`}>
                  {m.text}
                </div>

                {/* Citations block */}
                {m.citations && m.citations.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wide flex items-center gap-1">
                      <Database size={10} />
                      Grounded Citations:
                    </span>
                    {m.citations.map(c => (
                      <span 
                        key={c.id} 
                        className="text-[9px] font-semibold text-slate-400 bg-slate-950 border border-slate-850 px-1.5 py-0.5 rounded flex items-center gap-1 hover:text-slate-200 transition cursor-pointer"
                        title={c.title}
                      >
                        📄 {c.title.split(' ')[0]}... ({c.id})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 animate-pulse-subtle">
              <Loader2 size={13} className="animate-spin" />
            </div>
            <div className="p-3 bg-slate-900 border border-slate-850 text-slate-500 rounded-xl rounded-tl-none text-xs flex items-center gap-2">
              <span className="animate-pulse">AlertIQ is parsing security documents...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Chips */}
      {messages.length === 0 && (
        <div className="p-4 border-t border-slate-800/60 flex flex-wrap items-center gap-2 bg-slate-950/20">
          {chips.map((chip) => (
            <button
              key={chip}
              onClick={() => handleSendMessage(chip)}
              className="text-[10px] font-semibold text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800 hover:border-rose-500/30 px-3 py-1.5 rounded-full transition cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Message input */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/30">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputValue);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isTyping}
            placeholder="Ask a follow-up question about this alert..."
            className="flex-1 bg-slate-950/80 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 disabled:opacity-50 transition"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isTyping}
            className="p-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-all duration-200 cursor-pointer shrink-0"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
