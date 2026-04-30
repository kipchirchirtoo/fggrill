"use client";

import React, { useState, useEffect, useRef } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { UserRole } from "@/lib/user-roles";
import {
  MessageCircle,
  Send,
  Plus,
  Users,
  Search,
  MoreVertical,
  Smile,
  Paperclip,
  X,
  Check,
  CheckCheck,
  Edit2,
  Trash2,
  Reply,
  Hash,
  Loader2,
  Settings,
  Bell,
  BellOff,
  Phone,
  Video,
  Info,
  ChevronDown,
  Filter,
  Archive,
  Star,
  Clock,
  Tag,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { API_URL } from "@/lib/config";
import { 
  uploadFile, 
  subscribeToMessages, 
  subscribeToReactions,
  subscribeToChannels 
} from "@/lib/supabase-client";

export default function CommunicationsPage() {
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showChannelInfo, setShowChannelInfo] = useState(true); // Show by default like the image
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"messages" | "calls">("messages");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
    fetchChannels();
  }, []);

  useEffect(() => {
    if (selectedChannel) {
      fetchMessages(selectedChannel.id);
      markAsRead(selectedChannel.id);
      
      // Subscribe to real-time messages
      const messageSubscription = subscribeToMessages(
        selectedChannel.id,
        (payload) => {
          console.log('New message received:', payload);
          if (payload.new) {
            setMessages((prev) => [...prev, payload.new]);
            scrollToBottom();
          }
        }
      );

      // Subscribe to real-time reactions
      const reactionSubscription = subscribeToReactions((payload) => {
        console.log('Reaction update:', payload);
        fetchMessages(selectedChannel.id, true);
      });

      return () => {
        messageSubscription.unsubscribe();
        reactionSubscription.unsubscribe();
      };
    }
  }, [selectedChannel]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchChannels = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/communications/channels`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setChannels(result.data || []);
        if (!selectedChannel && result.data?.length > 0) {
          setSelectedChannel(result.data[0]);
        }
      }
    } catch (error) {
      console.error("Fetch Channels Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (channelId: string, silent = false) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/communications/channels/${channelId}/messages?limit=100`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();
      if (result.success) {
        setMessages(result.data || []);
      }
    } catch (error) {
      if (!silent) {
        console.error("Fetch Messages Error:", error);
      }
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel) return;

    setIsSending(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/communications/channels/${selectedChannel.id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: newMessage,
            reply_to: replyTo?.id,
          }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setNewMessage("");
        setReplyTo(null);
        // Real-time will handle adding the message
      } else {
        toast.error("Failed to send message");
      }
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedChannel || !currentUser) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setIsUploading(true);
    try {
      // Upload to Supabase Storage
      const uploadResult = await uploadFile(file, currentUser.id);

      // Send message with file attachment
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/communications/channels/${selectedChannel.id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Shared a file: ${uploadResult.name}`,
            message_type: uploadResult.type.startsWith("image/") ? "image" : "file",
            file_url: uploadResult.url,
            file_name: uploadResult.name,
            file_size: uploadResult.size,
            file_mime_type: uploadResult.type,
            reply_to: replyTo?.id,
          }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setReplyTo(null);
        toast.success("File uploaded successfully");
      } else {
        toast.error("Failed to send file");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const markAsRead = async (channelId: string) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/api/communications/channels/${channelId}/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchChannels(); // Refresh to update unread counts
    } catch (error) {
      console.error("Mark as Read Error:", error);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm("Delete this message?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/communications/messages/${messageId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();
      if (result.success) {
        toast.success("Message deleted");
        fetchMessages(selectedChannel.id);
      }
    } catch (error) {
      toast.error("Failed to delete message");
    }
  };

  const reactToMessage = async (messageId: string, emoji: string) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(
        `${API_URL}/api/communications/messages/${messageId}/react`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ emoji }),
        }
      );
      fetchMessages(selectedChannel.id, true);
    } catch (error) {
      console.error("React Error:", error);
    }
  };

  const isAdmin = currentUser?.role === "super_admin" || currentUser?.role === "director";

  const formatMessageTime = (date: string) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) {
      return format(messageDate, "h:mm a");
    } else if (isYesterday(messageDate)) {
      return "Yesterday";
    } else {
      return format(messageDate, "MMM d");
    }
  };

  const filteredChannels = channels.filter((channel) =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRoles={Object.values(UserRole)}>
      <DashboardLayout>
        <div className="h-[calc(100vh-4rem)] flex bg-[#f8f9fa]">
          {/* Left Sidebar - Compact like Aircall */}
          <div className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 space-y-6">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            
            <div className="flex-1 flex flex-col items-center space-y-4">
              <button
                onClick={() => setActiveTab("messages")}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  activeTab === "messages"
                    ? "bg-gray-900 text-white shadow-lg"
                    : "text-gray-400 hover:bg-gray-100"
                }`}
                title="Messages"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setActiveTab("calls")}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  activeTab === "calls"
                    ? "bg-gray-900 text-white shadow-lg"
                    : "text-gray-400 hover:bg-gray-100"
                }`}
                title="Calls"
              >
                <Phone className="w-5 h-5" />
              </button>
              
              <button
                className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-all"
                title="Users"
              >
                <Users className="w-5 h-5" />
              </button>
            </div>

            <button
              className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-all"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Channels List - Like Aircall Inbox */}
          <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-gray-900">Inbox</h2>
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setShowCreateChannel(true)}
                    className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 rounded-xl flex items-center justify-center text-white transition-all shadow-lg"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="flex gap-2 mb-4">
                <button className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-semibold flex items-center justify-center gap-2">
                  <Phone className="w-4 h-4" />
                  Calls
                </button>
                <button className="flex-1 bg-gray-100 text-gray-600 rounded-lg px-4 py-2 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-gray-200">
                  <MessageCircle className="w-4 h-4" />
                  Messages
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter name, number or company..."
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-emerald-500 focus:bg-white transition-all"
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                </div>
              ) : filteredChannels.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No channels found</p>
                </div>
              ) : (
                filteredChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannel(channel)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-all border-l-4 ${
                      selectedChannel?.id === channel.id
                        ? "border-l-emerald-500 bg-emerald-50"
                        : "border-l-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                          {channel.name.substring(0, 2).toUpperCase()}
                        </div>
                        {channel.unread_count > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {channel.unread_count}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-gray-900 truncate text-sm">
                            {channel.name}
                          </h3>
                          <span className="text-xs text-gray-400">
                            {channel.last_message?.[0] &&
                              formatMessageTime(channel.last_message[0].created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-emerald-600 font-medium">
                            {channel.channel_type}
                          </span>
                          {channel.last_message?.[0] && (
                            <p className="text-xs text-gray-500 truncate flex-1">
                              {channel.last_message[0].message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Area - Modern Design */}
          {selectedChannel ? (
            <div className="flex-1 flex flex-col bg-white">
              {/* Chat Header - Like Aircall */}
              <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                    {selectedChannel.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {selectedChannel.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedChannel.description || "Business communications"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 rounded-xl flex items-center justify-center text-white transition-all">
                    <Phone className="w-5 h-5" />
                  </button>
                  <button className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center text-gray-600 transition-all">
                    <Video className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowChannelInfo(!showChannelInfo)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                      showChannelInfo
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    Mark as done
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 flex">
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                  {messages.map((message, index) => {
                    const showDate =
                      index === 0 ||
                      !isToday(new Date(messages[index - 1].created_at)) ||
                      !isToday(new Date(message.created_at));

                    return (
                      <React.Fragment key={message.id}>
                        {showDate && (
                          <div className="flex items-center justify-center my-4">
                            <div className="bg-white px-4 py-1 rounded-full text-xs text-gray-500 font-medium shadow-sm">
                              {isToday(new Date(message.created_at))
                                ? "Today"
                                : isYesterday(new Date(message.created_at))
                                  ? "Yesterday"
                                  : format(new Date(message.created_at), "MMMM d, yyyy")}
                            </div>
                          </div>
                        )}
                        <MessageBubbleModern
                          message={message}
                          currentUser={currentUser}
                          onReply={setReplyTo}
                          onDelete={deleteMessage}
                          onReact={reactToMessage}
                        />
                      </React.Fragment>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Right Panel - Channel Insights (Like Aircall) */}
                {showChannelInfo && (
                  <div className="w-96 bg-gray-900 text-white p-6 overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                        Channel Insights
                      </h3>
                      <button
                        onClick={() => setShowChannelInfo(false)}
                        className="text-gray-400 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                        <span className="text-sm font-semibold">CRM Insights</span>
                        <ExternalLink className="w-3 h-3" />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Channel Name</span>
                          <span className="text-sm font-semibold">
                            {selectedChannel.name}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Type</span>
                          <span className="text-sm font-semibold capitalize">
                            {selectedChannel.channel_type}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Members</span>
                          <span className="text-sm font-semibold">
                            {selectedChannel.members?.[0]?.count || 0}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Status</span>
                          <span className="text-sm font-semibold text-emerald-400">
                            Active
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-800 pt-6">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
                        Summary
                      </h4>
                      <p className="text-sm text-gray-300 leading-relaxed mb-4">
                        {selectedChannel.description ||
                          "Business communications channel for team collaboration and updates."}
                      </p>
                      <div className="text-xs text-gray-500">
                        Powered by Aircall AI ✨
                      </div>
                    </div>

                    <div className="border-t border-gray-800 pt-6 mt-6">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
                        Tags & Notes
                      </h4>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold">
                          Customer Service
                        </span>
                        <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-semibold">
                          High Priority
                        </span>
                        <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs font-semibold">
                          Ongoing
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Users className="w-4 h-4" />
                        <span>
                          Created by{" "}
                          {selectedChannel.created_by_user?.first_name || "Admin"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Reply Preview */}
              {replyTo && (
                <div className="bg-blue-50 border-t border-blue-200 px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Reply className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-xs text-blue-600 font-semibold">
                        Replying to {replyTo.user?.first_name}
                      </p>
                      <p className="text-xs text-blue-800 truncate max-w-md">
                        {replyTo.message}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setReplyTo(null)}
                    className="p-1 hover:bg-blue-100 rounded transition-all"
                  >
                    <X className="w-4 h-4 text-blue-600" />
                  </button>
                </div>
              )}

              {/* Message Input - Modern */}
              <div className="bg-white border-t border-gray-200 p-4">
                <div className="flex items-end gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="p-2.5 hover:bg-gray-100 rounded-xl transition-all text-gray-600 disabled:opacity-50"
                    title="Attach file"
                  >
                    {isUploading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Paperclip className="w-5 h-5" />
                    )}
                  </button>
                  <div className="flex-1 relative">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Type a message..."
                      disabled={isUploading}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500 focus:bg-white resize-none transition-all disabled:opacity-50"
                      rows={1}
                      style={{
                        minHeight: "48px",
                        maxHeight: "120px",
                      }}
                    />
                  </div>
                  <button className="p-2.5 hover:bg-gray-100 rounded-xl transition-all text-gray-600">
                    <Smile className="w-5 h-5" />
                  </button>
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || isSending || isUploading}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-emerald-500/30"
                  >
                    {isSending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                  <MessageCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Select a channel
                </h3>
                <p className="text-gray-500">
                  Choose a channel from the list to start messaging
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Create Channel Modal */}
        {showCreateChannel && (
          <CreateChannelModal
            onClose={() => setShowCreateChannel(false)}
            onSuccess={() => {
              setShowCreateChannel(false);
              fetchChannels();
            }}
          />
        )}

        {/* Channel Info Modal */}
        {showChannelInfo && selectedChannel && (
          <ChannelInfoModal
            channel={selectedChannel}
            onClose={() => setShowChannelInfo(false)}
          />
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function MessageBubbleModern({ message, currentUser, onReply, onDelete, onReact }: any) {
  const [showActions, setShowActions] = useState(false);
  const isOwn = message.user_id === currentUser?.id;

  return (
    <div
      className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {!isOwn && (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {message.user?.first_name?.[0]}
          {message.user?.last_name?.[0]}
        </div>
      )}

      <div className={`flex-1 max-w-2xl ${isOwn ? "items-end" : ""}`}>
        {!isOwn && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900">
              {message.user?.first_name} {message.user?.last_name}
            </span>
            <span className="text-xs text-gray-400">
              {format(new Date(message.created_at), "h:mm a")}
            </span>
            {message.is_edited && (
              <span className="text-xs text-gray-400 italic">(edited)</span>
            )}
          </div>
        )}

        {message.reply_to_message && (
          <div className="bg-gray-100 border-l-4 border-gray-300 rounded-lg p-2 mb-2 text-xs max-w-md">
            <span className="font-semibold text-gray-600">
              {message.reply_to_message.users?.first_name}:
            </span>
            <span className="text-gray-500 ml-1">
              {message.reply_to_message.message}
            </span>
          </div>
        )}

        <div className="relative group">
          <div
            className={`${
              isOwn
                ? "bg-emerald-500 text-white"
                : "bg-white text-gray-900 border border-gray-200 shadow-sm"
            } rounded-2xl px-4 py-3 inline-block relative`}
          >
            {/* File attachment preview */}
            {message.file_url && (
              <div className="mb-2">
                {message.message_type === "image" ? (
                  <a
                    href={message.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={message.file_url}
                      alt={message.file_name}
                      className="max-w-sm rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ maxHeight: "300px" }}
                    />
                  </a>
                ) : (
                  <a
                    href={message.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      isOwn ? "bg-emerald-600" : "bg-gray-100"
                    } hover:opacity-90 transition-opacity`}
                  >
                    <Paperclip className="w-5 h-5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {message.file_name}
                      </p>
                      {message.file_size && (
                        <p className={`text-xs ${isOwn ? "text-emerald-100" : "text-gray-500"}`}>
                          {(message.file_size / 1024).toFixed(1)} KB
                        </p>
                      )}
                    </div>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
            
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {message.message}
            </p>
            {isOwn && (
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-xs text-emerald-100">
                  {format(new Date(message.created_at), "h:mm a")}
                </span>
                <CheckCheck className="w-3 h-3 text-emerald-100" />
              </div>
            )}
          </div>

          {showActions && (
            <div
              className={`absolute top-0 ${isOwn ? "left-0 -translate-x-full" : "right-0 translate-x-full"} flex gap-1 bg-white border border-gray-200 rounded-xl shadow-xl p-1.5 ml-2 mr-2`}
            >
              <button
                onClick={() => onReact(message.id, "👍")}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-all"
                title="Like"
              >
                👍
              </button>
              <button
                onClick={() => onReact(message.id, "❤️")}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-all"
                title="Love"
              >
                ❤️
              </button>
              <button
                onClick={() => onReact(message.id, "😊")}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-all"
                title="Smile"
              >
                😊
              </button>
              <div className="w-px bg-gray-200 mx-1"></div>
              <button
                onClick={() => onReply(message)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-all"
                title="Reply"
              >
                <Reply className="w-4 h-4 text-gray-600" />
              </button>
              {isOwn && (
                <button
                  onClick={() => onDelete(message.id)}
                  className="p-1.5 hover:bg-rose-100 rounded-lg transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                </button>
              )}
            </div>
          )}
        </div>

        {message.reactions && message.reactions.length > 0 && (
          <div className="flex gap-1 mt-2">
            {Object.entries(
              message.reactions.reduce((acc: any, r: any) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              }, {})
            ).map(([emoji, count]: any) => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                className="bg-white hover:bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1 text-xs flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span>{emoji}</span>
                <span className="text-gray-600 font-semibold">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateChannelModal({ onClose, onSuccess }: any) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    channel_type: "general",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/communications/channels`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (result.success) {
        toast.success("Channel created successfully");
        onSuccess();
      } else {
        toast.error(result.message || "Failed to create channel");
      }
    } catch (error) {
      toast.error("Failed to create channel");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-stone-900">Create Channel</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg"
          >
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              Channel Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-2 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF]"
              placeholder="e.g., General Announcements"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-4 py-2 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF] resize-none"
              rows={3}
              placeholder="What is this channel for?"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              Channel Type
            </label>
            <select
              value={formData.channel_type}
              onChange={(e) =>
                setFormData({ ...formData, channel_type: e.target.value })
              }
              className="w-full px-4 py-2 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF]"
            >
              <option value="general">General</option>
              <option value="department">Department</option>
              <option value="project">Project</option>
              <option value="branch">Branch</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border-2 border-stone-200 rounded-xl font-bold text-stone-700 hover:bg-stone-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-[#007AFF] text-white rounded-xl font-bold hover:bg-[#0056b3] disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Channel"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChannelInfoModal({ channel, onClose }: any) {
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/communications/channels/${channel.id}/members`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();
      if (result.success) {
        setMembers(result.data || []);
      }
    } catch (error) {
      console.error("Fetch Members Error:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-stone-900">Channel Info</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg"
          >
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="text-lg font-bold text-stone-900 mb-2">
              {channel.name}
            </h4>
            <p className="text-sm text-stone-600">{channel.description}</p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-stone-700 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Members ({members.length})
            </h4>
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-2 hover:bg-stone-50 rounded-lg"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                    {member.user?.first_name?.[0]}
                    {member.user?.last_name?.[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-stone-900">
                      {member.user?.first_name} {member.user?.last_name}
                    </p>
                    <p className="text-xs text-stone-500 capitalize">
                      {member.user?.role?.replace(/_/g, " ")}
                    </p>
                  </div>
                  {member.role === "admin" && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                      Admin
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
