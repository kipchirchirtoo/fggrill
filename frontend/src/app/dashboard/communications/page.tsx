"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { UserRole } from "@/lib/user-roles";
import {
  FileText,
  Hash,
  Info,
  Loader2,
  MessageCircle,
  Paperclip,
  Plus,
  Reply,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { API_URL } from "@/lib/config";
import {
  subscribeToMessages,
  subscribeToReactions,
  uploadFile,
} from "@/lib/supabase-client";

type Channel = {
  id: string;
  name: string;
  description?: string | null;
  channel_type?: string | null;
  unread_count?: number;
  created_at?: string;
  created_by_user?: {
    first_name?: string;
    last_name?: string;
  };
  members?: Array<{ count: number }>;
  last_message?: Array<{
    message: string;
    created_at: string;
    users?: {
      first_name?: string;
      last_name?: string;
    };
  }>;
};

type Message = {
  id: string;
  channel_id: string;
  user_id: string;
  message: string;
  message_type?: "text" | "image" | "file";
  file_url?: string;
  file_name?: string;
  file_size?: number;
  created_at: string;
  is_edited?: boolean;
  user?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    role?: string;
  };
  reply_to_message?: {
    id: string;
    message: string;
    users?: {
      first_name?: string;
      last_name?: string;
    };
  };
};

type Member = {
  id: string;
  role?: string;
  user?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    role?: string;
    email?: string;
  };
};

const getInitials = (first?: string, last?: string, fallback = "CH") => {
  const initials = `${first?.[0] || ""}${last?.[0] || ""}`.trim();
  return initials || fallback.substring(0, 2).toUpperCase();
};

const getChannelInitials = (name?: string) =>
  (name || "CH")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 2)
    .toUpperCase() || "CH";

export default function CommunicationsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
    fetchChannels();
  }, []);

  useEffect(() => {
    if (!selectedChannel) return;

    fetchMessages(selectedChannel.id);
    fetchMembers(selectedChannel.id);
    markAsRead(selectedChannel.id);

    const messageSubscription = subscribeToMessages(
      selectedChannel.id,
      (payload) => {
        if (payload.new) {
          setMessages((prev) => {
            if (prev.some((message) => message.id === payload.new.id))
              return prev;
            return [...prev, payload.new as Message];
          });
        }
      },
    );

    const reactionSubscription = subscribeToReactions(() => {
      fetchMessages(selectedChannel.id, true);
    });

    return () => {
      messageSubscription.unsubscribe();
      reactionSubscription.unsubscribe();
    };
  }, [selectedChannel?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredChannels = useMemo(
    () =>
      channels.filter((channel) =>
        `${channel.name} ${channel.description || ""}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
      ),
    [channels, searchQuery],
  );

  const isAdmin =
    currentUser?.role === "super_admin" || currentUser?.role === "director";

  const fetchChannels = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/communications/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (result.success) {
        const fetchedChannels = result.data || [];
        setChannels(fetchedChannels);
        setSelectedChannel((current) => current || fetchedChannels[0] || null);
      }
    } catch (error) {
      console.error("Fetch Channels Error:", error);
      toast.error("Could not load communication channels");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (channelId: string, silent = false) => {
    setIsMessagesLoading(!silent);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/communications/channels/${channelId}/messages?limit=100`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const result = await response.json();

      if (result.success) {
        setMessages(result.data || []);
      }
    } catch (error) {
      if (!silent) {
        console.error("Fetch Messages Error:", error);
        toast.error("Could not load messages");
      }
    } finally {
      setIsMessagesLoading(false);
    }
  };

  const fetchMembers = async (channelId: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/communications/channels/${channelId}/members`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const result = await response.json();

      if (result.success) {
        setMembers(result.data || []);
      }
    } catch (error) {
      console.error("Fetch Members Error:", error);
    }
  };

  const markAsRead = async (channelId: string) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/api/communications/channels/${channelId}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchChannels();
    } catch (error) {
      console.error("Mark as Read Error:", error);
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
            message: newMessage.trim(),
            reply_to: replyTo?.id,
          }),
        },
      );
      const result = await response.json();

      if (result.success) {
        setNewMessage("");
        setReplyTo(null);
      } else {
        toast.error(result.message || "Failed to send message");
      }
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !selectedChannel || !currentUser) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setIsUploading(true);
    try {
      const uploadResult = await uploadFile(file, currentUser.id);
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
            message_type: uploadResult.type.startsWith("image/")
              ? "image"
              : "file",
            file_url: uploadResult.url,
            file_name: uploadResult.name,
            file_size: uploadResult.size,
            file_mime_type: uploadResult.type,
            reply_to: replyTo?.id,
          }),
        },
      );
      const result = await response.json();

      if (result.success) {
        setReplyTo(null);
        toast.success("File shared");
      } else {
        toast.error(result.message || "Failed to share file");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!selectedChannel || !confirm("Delete this message?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/communications/messages/${messageId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const result = await response.json();

      if (result.success) {
        toast.success("Message deleted");
        fetchMessages(selectedChannel.id, true);
      } else {
        toast.error(result.message || "Failed to delete message");
      }
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete message");
    }
  };

  const formatChannelTime = (date?: string) => {
    if (!date) return "";
    const messageDate = new Date(date);
    if (isToday(messageDate)) return format(messageDate, "h:mm a");
    if (isYesterday(messageDate)) return "Yesterday";
    return format(messageDate, "MMM d");
  };

  return (
    <ProtectedRoute allowedRoles={Object.values(UserRole)}>
      <main className="h-screen w-screen overflow-hidden bg-slate-100 text-slate-950">
        <div className="grid h-full grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_320px]">
          <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                    Communications
                  </p>
                  <h1 className="mt-1 text-2xl font-bold text-slate-950">
                    Team inbox
                  </h1>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowCreateChannel(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700"
                    title="Create channel"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search conversations"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {isLoading ? (
                <div className="flex h-40 items-center justify-center text-emerald-600">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredChannels.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                  <MessageCircle className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">
                    No conversations found
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Try another search term.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredChannels.map((channel) => {
                    const lastMessage = channel.last_message?.[0];
                    const active = selectedChannel?.id === channel.id;

                    return (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => setSelectedChannel(channel)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          active
                            ? "border-emerald-200 bg-emerald-50 shadow-sm"
                            : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
                            {getChannelInitials(channel.name)}
                            {!!channel.unread_count &&
                              channel.unread_count > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                                  {channel.unread_count}
                                </span>
                              )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-sm font-bold text-slate-950">
                                {channel.name}
                              </p>
                              <span className="shrink-0 text-[11px] font-medium text-slate-400">
                                {formatChannelTime(lastMessage?.created_at)}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {lastMessage?.message ||
                                channel.description ||
                                "No messages yet"}
                            </p>
                            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-slate-600">
                              <Hash className="h-3 w-3" />
                              {channel.channel_type || "general"}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col bg-white">
            {selectedChannel ? (
              <>
                <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 px-6">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-base font-bold text-white">
                      {getChannelInitials(selectedChannel.name)}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold text-slate-950">
                        {selectedChannel.name}
                      </h2>
                      <p className="truncate text-sm text-slate-500">
                        {selectedChannel.description ||
                          "Team communication channel"}
                      </p>
                    </div>
                  </div>
                  <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:flex">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Active
                  </div>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-6 py-5">
                  {isMessagesLoading ? (
                    <div className="flex h-full items-center justify-center text-emerald-600">
                      <Loader2 className="h-7 w-7 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="max-w-sm text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-sm">
                          <MessageCircle className="h-8 w-8 text-emerald-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-950">
                          Start the conversation
                        </h3>
                        <p className="mt-2 text-sm text-slate-500">
                          Send the first update for this channel.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message, index) => {
                        const previousMessage = messages[index - 1];
                        const showDate =
                          index === 0 ||
                          format(
                            new Date(previousMessage.created_at),
                            "yyyy-MM-dd",
                          ) !==
                            format(new Date(message.created_at), "yyyy-MM-dd");

                        return (
                          <React.Fragment key={message.id}>
                            {showDate && (
                              <DateDivider date={message.created_at} />
                            )}
                            <MessageBubble
                              message={message}
                              currentUser={currentUser}
                              onReply={setReplyTo}
                              onDelete={deleteMessage}
                            />
                          </React.Fragment>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {replyTo && (
                  <div className="border-t border-emerald-100 bg-emerald-50 px-6 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                          Replying to {replyTo.user?.first_name || "message"}
                        </p>
                        <p className="mt-1 truncate text-sm text-emerald-900">
                          {replyTo.message}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyTo(null)}
                        className="rounded-lg p-1.5 text-emerald-700 transition hover:bg-emerald-100"
                        title="Cancel reply"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                <footer className="shrink-0 border-t border-slate-200 bg-white p-4">
                  <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-100">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
                      title="Attach file"
                    >
                      {isUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Paperclip className="h-5 w-5" />
                      )}
                    </button>
                    <textarea
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Write a message..."
                      disabled={isUploading}
                      rows={1}
                      className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-1 py-3 text-sm outline-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || isSending || isUploading}
                      className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Send
                    </button>
                  </div>
                </footer>
              </>
            ) : (
              <div className="flex h-full items-center justify-center bg-slate-50">
                <div className="max-w-sm text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-sm">
                    <MessageCircle className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-950">
                    Select a conversation
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Choose a channel from the inbox to view and send messages.
                  </p>
                </div>
              </div>
            )}
          </section>

          <aside className="hidden min-h-0 flex-col border-l border-slate-200 bg-white xl:flex">
            <div className="border-b border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-950">Channel details</h3>
                  <p className="text-xs text-slate-500">
                    Context and participants
                  </p>
                </div>
              </div>
            </div>

            {selectedChannel ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    About
                  </p>
                  <h4 className="mt-2 font-bold text-slate-950">
                    {selectedChannel.name}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {selectedChannel.description ||
                      "No description provided for this channel."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                      <Hash className="h-3 w-3" />
                      {selectedChannel.channel_type || "general"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      <Users className="h-3 w-3" />
                      {members.length ||
                        selectedChannel.members?.[0]?.count ||
                        0}{" "}
                      members
                    </span>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Members
                  </p>
                  <div className="space-y-2">
                    {members.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                        No members loaded.
                      </div>
                    ) : (
                      members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-slate-50"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                            {getInitials(
                              member.user?.first_name,
                              member.user?.last_name,
                              "US",
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {member.user?.first_name} {member.user?.last_name}
                            </p>
                            <p className="truncate text-xs capitalize text-slate-500">
                              {member.user?.role?.replace(/_/g, " ") ||
                                member.role ||
                                "member"}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 text-sm text-slate-500">
                Select a channel to view details.
              </div>
            )}
          </aside>
        </div>

        {showCreateChannel && (
          <CreateChannelModal
            onClose={() => setShowCreateChannel(false)}
            onSuccess={() => {
              setShowCreateChannel(false);
              fetchChannels();
            }}
          />
        )}
      </main>
    </ProtectedRoute>
  );
}

function DateDivider({ date }: { date: string }) {
  const messageDate = new Date(date);
  const label = isToday(messageDate)
    ? "Today"
    : isYesterday(messageDate)
      ? "Yesterday"
      : format(messageDate, "MMMM d, yyyy");

  return (
    <div className="flex items-center justify-center py-2">
      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
        {label}
      </span>
    </div>
  );
}

function MessageBubble({
  message,
  currentUser,
  onReply,
  onDelete,
}: {
  message: Message;
  currentUser: any;
  onReply: (message: Message) => void;
  onDelete: (messageId: string) => void;
}) {
  const isOwn = message.user_id === currentUser?.id;

  return (
    <div className={`flex gap-3 ${isOwn ? "justify-end" : "justify-start"}`}>
      {!isOwn && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
          {getInitials(message.user?.first_name, message.user?.last_name, "US")}
        </div>
      )}

      <div
        className={`group max-w-[72%] ${isOwn ? "items-end" : "items-start"}`}
      >
        {!isOwn && (
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">
              {message.user?.first_name} {message.user?.last_name}
            </span>
            <span className="text-[11px] text-slate-400">
              {format(new Date(message.created_at), "h:mm a")}
            </span>
          </div>
        )}

        {message.reply_to_message && (
          <div className="mb-2 rounded-xl border-l-4 border-emerald-300 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
            <span className="font-bold">
              {message.reply_to_message.users?.first_name || "Reply"}:{" "}
            </span>
            {message.reply_to_message.message}
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-3 shadow-sm ${
            isOwn
              ? "rounded-br-md bg-emerald-600 text-white"
              : "rounded-bl-md border border-slate-200 bg-white text-slate-900"
          }`}
        >
          {message.file_url && (
            <div className="mb-3">
              {message.message_type === "image" ? (
                <a
                  href={message.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src={message.file_url}
                    alt={message.file_name || "Attachment"}
                    className="max-h-72 rounded-xl object-cover"
                  />
                </a>
              ) : (
                <a
                  href={message.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 rounded-xl p-3 transition hover:opacity-90 ${
                    isOwn ? "bg-emerald-700" : "bg-slate-100"
                  }`}
                >
                  <FileText className="h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {message.file_name || "Attachment"}
                    </p>
                    {!!message.file_size && (
                      <p
                        className={`text-xs ${isOwn ? "text-emerald-100" : "text-slate-500"}`}
                      >
                        {(message.file_size / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                </a>
              )}
            </div>
          )}

          <p className="whitespace-pre-wrap break-words text-sm leading-6">
            {message.message}
          </p>
          <div
            className={`mt-1 text-right text-[11px] ${isOwn ? "text-emerald-100" : "text-slate-400"}`}
          >
            {format(new Date(message.created_at), "h:mm a")}
            {message.is_edited ? " · edited" : ""}
          </div>
        </div>

        <div
          className={`mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100 ${isOwn ? "justify-end" : "justify-start"}`}
        >
          <button
            type="button"
            onClick={() => onReply(message)}
            className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-500 shadow-sm transition hover:text-emerald-700"
          >
            <Reply className="h-3 w-3" />
            Reply
          </button>
          {isOwn && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-rose-500 shadow-sm transition hover:text-rose-700"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          )}
        </div>
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
        toast.success("Channel created");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Create channel</h3>
            <p className="mt-1 text-sm text-slate-500">
              Add a focused space for team updates.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Channel name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(event) =>
                setFormData({ ...formData, name: event.target.value })
              }
              className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              placeholder="e.g. Operations"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(event) =>
                setFormData({ ...formData, description: event.target.value })
              }
              className="min-h-24 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              placeholder="What should this channel be used for?"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Type
            </label>
            <select
              value={formData.channel_type}
              onChange={(event) =>
                setFormData({ ...formData, channel_type: event.target.value })
              }
              className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="general">General</option>
              <option value="department">Department</option>
              <option value="project">Project</option>
              <option value="branch">Branch</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-11 flex-1 rounded-xl border border-slate-200 font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 flex-1 rounded-xl bg-emerald-600 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
