import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Loader2 } from 'lucide-react';
import type { ChatMessage } from '../../types/contract';
import { useAuth } from '../../context/AuthContext';
import { SafeContent } from '../../services/sanitizer';

interface ReportChatProps {
  entryId: string;
  reportTitle?: string | null;
}

export const ReportChat: React.FC<ReportChatProps> = ({ entryId, reportTitle }) => {
  const { apiClient } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: `Hello. I have loaded the evidence ledger, timeline, and extracted claims for "${reportTitle || 'this report'}". What specific claim, source citation, or timeline discrepancy would you like to discuss?`,
      timestamp: new Date().toISOString(),
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = inputMessage.trim();
    if (!cleanText || isStreaming) return;

    setInputMessage('');
    setChatError(null);

    const userMsgId = `user_${Date.now()}`;
    const assistantMsgId = `assistant_${Date.now()}`;

    // Append user message immediately
    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: cleanText,
      timestamp: new Date().toISOString(),
    };

    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      sender: 'assistant',
      text: '',
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMsg]);
    setIsStreaming(true);

    abortRef.current = new AbortController();

    try {
      let accumulatedResponse = '';

      for await (const chunk of apiClient.streamEntryChat(
        entryId,
        cleanText,
        abortRef.current.signal
      )) {
        accumulatedResponse += chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, text: accumulatedResponse } : msg
          )
        );
      }
    } catch (err: unknown) {
      console.error('Chat streaming failed:', err);
      setChatError(err instanceof Error ? err.message : 'Error communicating with model assistant.');
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId && !msg.text
            ? {
                ...msg,
                text: 'I was unable to complete the response due to a connection or rate-limit issue. Please try again.',
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[560px]">
      {/* Geometric Balance Chat Header */}
      <div className="bg-[#1A1A1B] text-white p-4 border-b border-[#2D2D2E] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white shadow-xs">
            AI
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>Gemini 2.5 Pro Assistant</span>
              <span className="text-[10px] font-mono text-[#38BDF8] font-semibold bg-[#0F172A] px-1.5 py-0.5 rounded border border-[#38BDF8]/30">
                Grounding Active
              </span>
            </h4>
            <p className="text-[10px] text-gray-400">
              Direct investigation discussion grounded exclusively in this report&apos;s verified ledger.
            </p>
          </div>
        </div>

        <div className="text-[10px] font-mono text-gray-400 uppercase tracking-widest hidden sm:block">
          Authenticated Stream
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFC]">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-2xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-xs ${
                  isUser
                    ? 'bg-[#0F172A] text-white'
                    : 'bg-gradient-to-tr from-purple-500 to-blue-500 text-white'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : 'AI'}
              </div>

              <div
                className={`p-3.5 rounded-xl text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-[#0F172A] text-white rounded-tr-xs shadow-xs'
                    : 'bg-white border border-gray-200 text-[#1A1A1B] rounded-tl-xs shadow-xs'
                }`}
              >
                {msg.text ? (
                  <SafeContent
                    content={msg.text}
                    className={isUser ? 'text-white' : 'text-[#1A1A1B]'}
                  />
                ) : (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#38BDF8]" />
                    <span className="text-xs">Consulting evidence ledger...</span>
                  </div>
                )}

                <div
                  className={`text-[10px] mt-1.5 font-mono ${
                    isUser ? 'text-gray-400 text-right' : 'text-gray-400'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {chatError && (
        <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-rose-700 text-xs">
          {chatError}
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t border-gray-200 bg-white flex items-center gap-2"
      >
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Ask a question about this report's sources or timeline..."
          disabled={isStreaming}
          className="flex-1 text-xs sm:text-sm px-3.5 py-2.5 rounded-lg border border-gray-200 bg-[#F8FAFC] focus:bg-white focus:ring-2 focus:ring-[#38BDF8] focus:outline-none text-[#1A1A1B] placeholder:text-gray-400"
        />

        <button
          type="submit"
          disabled={!inputMessage.trim() || isStreaming}
          aria-label="Send message"
          className="px-4 py-2.5 bg-[#38BDF8] hover:bg-[#38BDF8]/90 text-[#0F172A] font-bold text-xs rounded-lg transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {isStreaming ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#0F172A]" />
          ) : (
            <>
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
