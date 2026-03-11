import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Settings as SettingsIcon, LogOut, Loader2, RefreshCw, Users, Shield, Ban, CheckCircle, X, Globe, MessageSquareText, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface ChatInterfaceProps {
  user: any;
  onLogout: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatInterface({ user, onLogout }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState('http://host.docker.internal:11434');
  const [showSettings, setShowSettings] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [fetchingModels, setFetchingModels] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  
  // Block Modal State
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [userToBlock, setUserToBlock] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockDuration, setBlockDuration] = useState('0'); // 0 = permanent
  
  // Logs Modal State
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [userToViewLogs, setUserToViewLogs] = useState<any>(null);
  const [userLogs, setUserLogs] = useState<any[]>([]);
  const [allLogsModalOpen, setAllLogsModalOpen] = useState(false);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [chatLayout, setChatLayout] = useState<'bubble' | 'minimal'>('bubble');
  const [chatWidth, setChatWidth] = useState<'normal' | 'wide'>('normal');

  // Deletion State
  const [deleteSelfModalOpen, setDeleteSelfModalOpen] = useState(false);
  const [deleteUserModalOpen, setDeleteUserModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchModels();
  }, [ollamaUrl]);

  const fetchModels = async () => {
    setFetchingModels(true);
    try {
      // In a real Docker setup, we might need to proxy this through our backend to avoid CORS
      // if the browser can't reach the Ollama URL directly.
      // However, our backend has a proxy endpoint!
      const res = await fetch(`/api/ollama/tags?url=${encodeURIComponent(ollamaUrl)}`);
      if (res.ok) {
        const data = await res.json();
        const modelNames = data.models?.map((m: any) => m.name) || [];
        setModels(modelNames);
        if (modelNames.length > 0 && !selectedModel) {
          setSelectedModel(modelNames[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch models', err);
    } finally {
      setFetchingModels(false);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setAdminUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const toggleBlockUser = async (user: any) => {
    if (user.is_blocked) {
      // Unblock immediately
      try {
        const res = await fetch(`/api/admin/users/${user.id}/toggle-block`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_blocked: false })
        });
        if (res.ok) fetchAdminUsers();
      } catch (err) {
        console.error('Failed to unblock', err);
      }
    } else {
      // Open block modal
      setUserToBlock(user);
      setBlockReason('');
      setBlockDuration('0');
      setBlockModalOpen(true);
    }
  };

  const submitBlock = async () => {
    if (!userToBlock) return;
    try {
      const durationMinutes = parseInt(blockDuration) > 0 ? parseInt(blockDuration) : null;
      const res = await fetch(`/api/admin/users/${userToBlock.id}/toggle-block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          is_blocked: true, 
          reason: blockReason, 
          durationMinutes 
        })
      });
      if (res.ok) {
        fetchAdminUsers();
        setBlockModalOpen(false);
        setUserToBlock(null);
      }
    } catch (err) {
      console.error('Failed to block user', err);
    }
  };

  const deleteSelfAccount = async () => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onLogout(); // Log the user out after successful deletion
      }
    } catch (err) {
      console.error('Failed to delete account', err);
    }
  };

  const deleteUserAccount = async () => {
    if (!userToDelete) return;
    try {
      const res = await fetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchAdminUsers();
        setDeleteUserModalOpen(false);
        setUserToDelete(null);
        if (userToDelete.id === user.id) {
          onLogout(); // If admin deletes themselves
        }
      }
    } catch (err) {
      console.error('Failed to delete user', err);
    }
  };

  const fetchUserLogs = async (user: any) => {
    setUserToViewLogs(user);
    setUserLogs([]);
    setLogsModalOpen(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/logs`);
      if (res.ok) {
        const data = await res.json();
        setUserLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch user logs', err);
    }
  };

  const fetchAllLogs = async () => {
    setAllLogs([]);
    setAllLogsModalOpen(true);
    try {
      const res = await fetch('/api/admin/logs');
      if (res.ok) {
        const data = await res.json();
        setAllLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch all logs', err);
    }
  };

  useEffect(() => {
    if (showAdmin) {
      fetchAdminUsers();
    }
  }, [showAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !selectedModel) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ollama/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: [...messages, userMessage],
          stream: true,
          ollamaUrl,
          webSearch,
        }),
      });

      if (!res.ok) throw new Error(res.statusText);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader available');

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        // Ollama stream returns JSON objects per line
        const lines = chunk.split('\n').filter((line) => line.trim() !== '');

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.message?.content) {
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg.role === 'assistant') {
                  lastMsg.content += json.message.content;
                }
                return newMessages;
              });
            }
            if (json.done) {
              setLoading(false);
            }
          } catch (e) {
            console.error('Error parsing JSON chunk', e);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error: Failed to connect to Ollama. Please check your settings and ensure Ollama is running.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-900 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <Bot className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="font-bold text-lg">The AI UI</h1>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {user.username}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-sm rounded-lg px-3 py-2 pr-8 appearance-none focus:ring-2 focus:ring-indigo-500/50 focus:outline-none min-w-[150px]"
              disabled={loading}
            >
              {models.length === 0 ? (
                <option value="">No models found</option>
              ) : (
                models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))
              )}
            </select>
            {fetchingModels && (
              <div className="absolute right-8 top-1/2 -translate-y-1/2">
                <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setShowSettings(!showSettings);
              setShowAdmin(false);
            }}
            className={`p-2 rounded-lg transition-colors ${
              showSettings ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-zinc-700 text-zinc-400'
            }`}
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          {user.role === 'admin' && (
            <button
              onClick={() => {
                setShowAdmin(!showAdmin);
                setShowSettings(false);
              }}
              className={`p-2 rounded-lg transition-colors ${
                showAdmin ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-zinc-700 text-zinc-400'
              }`}
              title="Admin Panel"
            >
              <Users className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onLogout}
            className="p-2 hover:bg-red-500/10 hover:text-red-400 text-zinc-400 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-zinc-800 border-b border-zinc-700 overflow-hidden"
          >
            <div className="p-6 max-w-2xl mx-auto space-y-8 max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
              {/* Layout Settings */}
              <div>
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4 text-indigo-400" /> Layout Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">
                      Message Style
                    </label>
                    <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-700">
                      <button
                        onClick={() => setChatLayout('bubble')}
                        className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
                          chatLayout === 'bubble' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Bubbles
                      </button>
                      <button
                        onClick={() => setChatLayout('minimal')}
                        className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
                          chatLayout === 'minimal' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Minimal
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">
                      Chat Width
                    </label>
                    <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-700">
                      <button
                        onClick={() => setChatWidth('normal')}
                        className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
                          chatWidth === 'normal' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Normal
                      </button>
                      <button
                        onClick={() => setChatWidth('wide')}
                        className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
                          chatWidth === 'wide' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Wide
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connection Settings (Admin Only) */}
              {user.role === 'admin' && (
                <div className="pt-6 border-t border-zinc-700">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-400" /> Connection Settings
                  </h3>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-zinc-400 mb-1">
                        Ollama URL (Backend Proxy Target)
                      </label>
                      <input
                        type="text"
                        value={ollamaUrl}
                        onChange={(e) => setOllamaUrl(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none"
                        placeholder="http://host.docker.internal:11434"
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        Use <code>http://host.docker.internal:11434</code> if running in Docker.
                      </p>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={fetchModels}
                        disabled={fetchingModels}
                        className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${fetchingModels ? 'animate-spin' : ''}`} />
                        Refresh Models
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Danger Zone */}
              <div className="pt-6 border-t border-zinc-700">
                <h3 className="font-medium mb-4 flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" /> Danger Zone
                </h3>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-zinc-200">Delete Account</h4>
                    <p className="text-xs text-zinc-400 mt-1">Permanently delete your account and all your chat history.</p>
                  </div>
                  <button
                    onClick={() => setDeleteSelfModalOpen(true)}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition-colors border border-red-500/30"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Panel */}
      <AnimatePresence>
        {showAdmin && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-zinc-800 border-b border-zinc-700 overflow-hidden"
          >
            <div className="p-6 max-w-4xl mx-auto max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" /> User Management
                </h3>
                <button
                  onClick={fetchAllLogs}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-colors flex items-center gap-2"
                >
                  <MessageSquareText className="w-4 h-4" /> View All Global Logs
                </button>
              </div>
              <div className="bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-800/50 text-zinc-400 border-b border-zinc-700">
                    <tr>
                      <th className="px-4 py-3 font-medium">ID</th>
                      <th className="px-4 py-3 font-medium">Username</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {adminUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3 text-zinc-500">#{u.id}</td>
                        <td className="px-4 py-3 font-medium">{u.username}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${u.role === 'admin' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {u.is_blocked ? (
                            <div className="flex flex-col">
                              <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
                                <Ban className="w-3 h-3" /> Blocked
                              </span>
                              {u.block_expires_at && (
                                <span className="text-[10px] text-zinc-500 mt-0.5">
                                  Until: {new Date(u.block_expires_at).toLocaleString()}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                              <CheckCircle className="w-3 h-3" /> Active
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => fetchUserLogs(u)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 mr-2"
                            title="View Chat Logs"
                          >
                            Logs
                          </button>
                          {u.id !== user.id && u.role !== 'admin' && (
                            <button
                              onClick={() => toggleBlockUser(u)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors mr-2 ${
                                u.is_blocked 
                                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' 
                                  : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400'
                              }`}
                            >
                              {u.is_blocked ? 'Unblock' : 'Block'}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setUserToDelete(u);
                              setDeleteUserModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-red-500/10 hover:bg-red-500/20 text-red-400"
                            title="Delete User"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Block User Modal */}
      <AnimatePresence>
        {blockModalOpen && userToBlock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-800 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-700 bg-zinc-800/50">
                <h3 className="font-medium flex items-center gap-2 text-red-400">
                  <Ban className="w-4 h-4" /> Block User: {userToBlock.username}
                </h3>
                <button 
                  onClick={() => setBlockModalOpen(false)}
                  className="p-1 hover:bg-zinc-700 rounded-lg text-zinc-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Ban Duration</label>
                  <select
                    value={blockDuration}
                    onChange={(e) => setBlockDuration(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none"
                  >
                    <option value="0">Permanent</option>
                    <option value="15">15 Minutes</option>
                    <option value="60">1 Hour</option>
                    <option value="1440">24 Hours</option>
                    <option value="10080">7 Days</option>
                    <option value="43200">30 Days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Reason (Visible to user)</label>
                  <textarea
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="e.g., Violation of terms of service"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:outline-none min-h-[100px] resize-none"
                  />
                </div>
              </div>
              <div className="p-4 border-t border-zinc-700 bg-zinc-800/50 flex justify-end gap-3">
                <button
                  onClick={() => setBlockModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitBlock}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
                >
                  Confirm Block
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Self Modal */}
      <AnimatePresence>
        {deleteSelfModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-800 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-700 bg-zinc-800/50">
                <h3 className="font-medium flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" /> Delete Account
                </h3>
                <button 
                  onClick={() => setDeleteSelfModalOpen(false)}
                  className="p-1 hover:bg-zinc-700 rounded-lg text-zinc-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-zinc-300">
                  Are you sure you want to delete your account? This action is <strong>permanent</strong> and cannot be undone. All your chat history will be lost.
                </p>
              </div>
              <div className="p-4 border-t border-zinc-700 bg-zinc-800/50 flex justify-end gap-3">
                <button
                  onClick={() => setDeleteSelfModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteSelfAccount}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
                >
                  Yes, Delete My Account
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete User Modal (Admin) */}
      <AnimatePresence>
        {deleteUserModalOpen && userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-800 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-700 bg-zinc-800/50">
                <h3 className="font-medium flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" /> Delete User
                </h3>
                <button 
                  onClick={() => setDeleteUserModalOpen(false)}
                  className="p-1 hover:bg-zinc-700 rounded-lg text-zinc-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-zinc-300">
                  Are you sure you want to delete the user <strong>{userToDelete.username}</strong>? This action is permanent and will delete all their chat history.
                </p>
              </div>
              <div className="p-4 border-t border-zinc-700 bg-zinc-800/50 flex justify-end gap-3">
                <button
                  onClick={() => setDeleteUserModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteUserAccount}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
                >
                  Delete User
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Logs Modal */}
      <AnimatePresence>
        {logsModalOpen && userToViewLogs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-800 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-700 bg-zinc-800/50">
                <h3 className="font-medium flex items-center gap-2 text-indigo-400">
                  <MessageSquareText className="w-4 h-4" /> Chat Logs: {userToViewLogs.username}
                </h3>
                <button 
                  onClick={() => setLogsModalOpen(false)}
                  className="p-1 hover:bg-zinc-700 rounded-lg text-zinc-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-zinc-900/50">
                {userLogs.length === 0 ? (
                  <p className="text-zinc-500 text-center py-8">No chat logs found for this user.</p>
                ) : (
                  userLogs.map((log) => (
                    <div key={log.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-3">
                      <div className="text-xs text-zinc-500 mb-1">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                      <div className="text-sm text-zinc-200 whitespace-pre-wrap">
                        {log.message}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-zinc-700 bg-zinc-800/50 flex justify-end">
                <button
                  onClick={() => setLogsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* All Logs Modal */}
      <AnimatePresence>
        {allLogsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-800 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-700 bg-zinc-800/50">
                <h3 className="font-medium flex items-center gap-2 text-indigo-400">
                  <MessageSquareText className="w-4 h-4" /> Global Chat Logs
                </h3>
                <button 
                  onClick={() => setAllLogsModalOpen(false)}
                  className="p-1 hover:bg-zinc-700 rounded-lg text-zinc-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-zinc-900/50">
                {allLogs.length === 0 ? (
                  <p className="text-zinc-500 text-center py-8">No chat logs found across the system.</p>
                ) : (
                  allLogs.map((log) => (
                    <div key={log.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-medium text-indigo-400">
                          @{log.username}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-sm text-zinc-200 whitespace-pre-wrap">
                        {log.message}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-zinc-700 bg-zinc-800/50 flex justify-end">
                <button
                  onClick={() => setAllLogsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        <div className={`mx-auto ${chatWidth === 'wide' ? 'max-w-6xl' : 'max-w-4xl'} space-y-6`}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500 opacity-50">
              <Bot className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm">Select a model and say hello!</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${
                  chatLayout === 'bubble'
                    ? msg.role === 'user' ? 'justify-end' : 'justify-start'
                    : 'justify-start border-b border-zinc-800/50 pb-6'
                }`}
              >
                {/* Avatar */}
                {(msg.role === 'assistant' || chatLayout === 'minimal') && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user' 
                      ? 'bg-zinc-700' 
                      : 'bg-indigo-500/20 border border-indigo-500/30'
                  }`}>
                    {msg.role === 'user' ? (
                      <User className="w-5 h-5 text-zinc-400" />
                    ) : (
                      <Bot className="w-5 h-5 text-indigo-400" />
                    )}
                  </div>
                )}
                
                {/* Message Content */}
                <div
                  className={`${
                    chatLayout === 'bubble'
                      ? `max-w-[80%] rounded-2xl px-5 py-3 ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-zinc-800 border border-zinc-700 text-zinc-100'
                        }`
                      : 'flex-1 text-zinc-100 pt-1'
                  }`}
                >
                  <div className="markdown-body text-sm leading-relaxed">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>

                {/* User Avatar (Bubble Layout) */}
                {msg.role === 'user' && chatLayout === 'bubble' && (
                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-zinc-400" />
                  </div>
                )}
              </motion.div>
            ))
          )}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-4 ${chatLayout === 'bubble' ? 'justify-start' : 'justify-start border-b border-zinc-800/50 pb-6'}`}
            >
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 border border-indigo-500/30">
                <Bot className="w-5 h-5 text-indigo-400" />
              </div>
              <div className={`${chatLayout === 'bubble' ? 'bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 text-zinc-100' : 'pt-2'}`}>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-zinc-800 border-t border-zinc-700">
        <form onSubmit={handleSubmit} className={`mx-auto relative ${chatWidth === 'wide' ? 'max-w-6xl' : 'max-w-4xl'}`}>
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => setWebSearch(!webSearch)}
              className={`absolute left-3 z-10 p-1.5 rounded-md transition-colors ${
                webSearch ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
              }`}
              title={webSearch ? "Web Search Enabled" : "Enable Web Search"}
            >
              <Globe className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedModel ? `Message ${selectedModel}...` : "Select a model to start chatting..."}
              disabled={loading || !selectedModel}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-12 pr-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading || !selectedModel}
              className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-0 disabled:pointer-events-none"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
        <p className="text-center text-xs text-zinc-500 mt-3">
          AI can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
