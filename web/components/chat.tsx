"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { getMessages, sendMessage, markMessagesRead } from "@/lib/api";
import type { Message } from "@/lib/types";

interface ChatProps {
  jobId: string;
  token: string;
  currentUserId: string;
}

export default function Chat({ jobId, token, currentUserId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);
  const prevMessageCount = useRef(0);

  const scrollToBottom = () => {
    // Scroll only within the chat container, not the whole page
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await getMessages(jobId, token);
      setMessages(response.messages);
      setError(null);
    } catch (err: any) {
      // Don't show error for 400 (no agent assigned yet)
      if (!err.message?.includes("agent is assigned")) {
        setError(err.message || "Failed to load messages");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Poll for new messages every 5 seconds
    pollIntervalRef.current = setInterval(fetchMessages, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [jobId, token]);

  useEffect(() => {
    // Only auto-scroll if new messages arrived (not on initial load)
    if (!isInitialLoad.current && messages.length > prevMessageCount.current) {
      scrollToBottom();
    }
    isInitialLoad.current = false;
    prevMessageCount.current = messages.length;
  }, [messages]);

  // Mark messages as read when component mounts or messages change
  useEffect(() => {
    if (messages.length > 0) {
      markMessagesRead(jobId, token).catch(() => {
        // Silently ignore errors
      });
    }
  }, [messages.length, jobId, token]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      const message = await sendMessage(jobId, newMessage.trim(), token);
      setMessages((prev) => [...prev, message]);
      setNewMessage("");
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return date.toLocaleDateString();
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    if (date !== currentDate) {
      currentDate = date;
      groupedMessages.push({ date, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  if (loading) {
    return (
      <div className="border-2 border-white p-8">
        <div className="flex items-center justify-center gap-2 text-white/50">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>LOADING MESSAGES...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-white flex flex-col max-h-[80vh]">
      {/* Header */}
      <div className="border-b border-white/30 px-4 py-3 flex items-center gap-2 flex-shrink-0">
        <MessageSquare className="h-4 w-4 flex-shrink-0" />
        <h3 className="text-sm font-bold tracking-wider whitespace-nowrap">CHAT</h3>
        <span className="text-xs text-white/50 whitespace-nowrap">({messages.length} messages)</span>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/50 text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          groupedMessages.map((group, groupIdx) => (
            <div key={groupIdx}>
              {/* Date separator */}
              <div className="flex items-center gap-4 my-4">
                <div className="flex-1 border-t border-white/20" />
                <span className="text-xs text-white/50">{group.date}</span>
                <div className="flex-1 border-t border-white/20" />
              </div>

              {/* Messages for this date */}
              {group.messages.map((msg) => {
                const isOwnMessage = msg.sender_id === currentUserId;
                const isClient = msg.sender_type === "client";

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} mb-3`}
                  >
                    <div
                      className={`max-w-[75%] ${
                        isOwnMessage
                          ? isClient
                            ? "bg-green-900/30 border border-green-400/50"
                            : "bg-blue-900/30 border border-blue-400/50"
                          : "bg-white/5 border border-white/20"
                      } px-4 py-2`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-bold ${
                            isClient ? "text-green-400" : "text-blue-400"
                          }`}
                        >
                          {msg.sender_name}
                        </span>
                        <span className="text-[10px] text-white/40">
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                      <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/50">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-white/30 p-3 sm:p-4 flex-shrink-0 sticky bottom-0 bg-black">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 min-w-0 bg-black border-2 border-white px-3 sm:px-4 py-2 text-sm focus:outline-none focus:border-green-400"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="border-2 border-white px-3 sm:px-4 py-2 hover:bg-white hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
