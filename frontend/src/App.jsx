import { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    fetchUploadedFiles();
  }, []);

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(""), 3000);
  };

  const fetchUploadedFiles = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/get-documents/");
      const data = await response.json();
      setUploadedFiles(data.documents || []);
    } catch (error) {
      console.log("Could not fetch documents list");
    }
  };

  // Handle drag and drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      setFile(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      showNotification("📁 Please select a PDF first!");
      return;
    }
    
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:8000/upload-pdf/", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      
      setMessages(prev => [...prev, { 
        role: "system", 
        content: `✅ ${data.status} (${data.chunks_created} chunks created)`,
        timestamp: new Date().toLocaleTimeString()
      }]);
      
      setFile(null);
      showNotification("✅ PDF uploaded successfully!");
      fetchUploadedFiles();
    } catch (error) {
      showNotification("❌ Error uploading file. Is your Python server running?");
      setMessages(prev => [...prev, { 
        role: "system", 
        content: "❌ Error uploading PDF",
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setUploading(false);
    }
  };

  const handleChat = async () => {
    if (!question.trim()) return;
    
    const userQuestion = question;
    setQuestion("");
    setMessages(prev => [...prev, { 
      role: "user", 
      content: userQuestion,
      timestamp: new Date().toLocaleTimeString()
    }]);
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userQuestion }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, { 
        role: "ai", 
        content: data.answer,
        timestamp: new Date().toLocaleTimeString()
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: "ai", 
        content: "❌ Error connecting to AI. Make sure the server is running.",
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    if (window.confirm("Clear all messages?")) {
      setMessages([]);
      showNotification("💬 Chat cleared");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showNotification("📋 Copied to clipboard!");
  };

  const exportChat = () => {
    const chatText = messages.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join("\n\n");
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(chatText));
    element.setAttribute("download", `chat-${Date.now()}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showNotification("📥 Chat exported!");
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
      
      {/* SIDEBAR */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col border-r border-slate-700 shadow-2xl overflow-hidden`}>
        
        {/* Header */}
        <div className="p-5 border-b border-slate-700 bg-gradient-to-r from-blue-600 to-purple-600">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            🤖 AI Chat
          </h1>
          <p className="text-sm text-blue-100 mt-1">PDF Knowledge Assistant</p>
        </div>

        {/* Upload Section */}
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">📤 Upload PDF</h3>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
              dragActive ? 'border-blue-400 bg-blue-500/10' : 'border-slate-600 hover:border-slate-500'
            }`}
          >
            <p className="text-xs text-slate-400 mb-2">Drag & drop or click</p>
            <input 
              type="file" 
              accept=".pdf" 
              onChange={(e) => setFile(e.target.files[0])} 
              className="hidden" 
              id="file-input"
            />
            <label htmlFor="file-input" className="cursor-pointer text-blue-400 text-sm font-semibold hover:text-blue-300">
              Select PDF
            </label>
          </div>
          
          {file && <p className="text-xs text-green-400 mt-2">✓ {file.name}</p>}
          
          <button 
            onClick={handleUpload}
            disabled={uploading}
            className="w-full mt-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition-all"
          >
            {uploading ? "⏳ Uploading..." : "📨 Upload & Process"}
          </button>
        </div>

        {/* Documents List */}
        <div className="p-4 border-b border-slate-700 flex-1 overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">📄 Documents</h3>
          {uploadedFiles.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No documents yet</p>
          ) : (
            <div className="space-y-2">
              {uploadedFiles.map((doc, idx) => (
                <div key={idx} className="bg-slate-700/50 p-2 rounded text-xs text-slate-300 hover:bg-slate-700 transition-colors">
                  <p className="truncate">📄 {doc}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 space-y-2 border-t border-slate-700">
          <button 
            onClick={clearChat}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold py-2 rounded-lg transition-all text-sm"
          >
            🗑️ Clear Chat
          </button>
          <button 
            onClick={exportChat}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold py-2 rounded-lg transition-all text-sm"
          >
            📥 Export Chat
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold py-2 rounded-lg transition-all text-sm"
          >
            ⚙️ Settings
          </button>
        </div>

        {/* Settings */}
        {showSettings && (
          <div className="p-4 border-t border-slate-700 bg-slate-800/50 text-sm text-slate-300 space-y-2">
            <p>✨ <strong>Theme:</strong> Dark Mode</p>
            <p>🔤 <strong>AI Model:</strong> Llama 3.3 70B</p>
            <p>⚡ <strong>Response:</strong> Auto-scroll enabled</p>
          </div>
        )}
      </div>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col">
        
        {/* Header with Toggle */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-700 p-4 flex justify-between items-center shadow-lg">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
          <h2 className="text-xl font-bold text-white">💬 Chat with Your PDFs</h2>
          <div className="text-sm text-slate-400">{messages.length} messages</div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col justify-center items-center">
              <div className="text-center">
                <h3 className="text-4xl mb-4">📚</h3>
                <h3 className="text-2xl font-bold text-slate-300 mb-2">Welcome to AI Chat!</h3>
                <p className="text-slate-400">Upload a PDF and start asking questions</p>
              </div>
            </div>
          )}
          
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xl group relative ${
                msg.role === 'user' ? '' : ''
              }`}>
                <div className={`p-4 rounded-lg shadow-md transition-all ${
                  msg.role === 'user' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-none' : 
                  msg.role === 'ai' ? 'bg-gradient-to-r from-slate-700 to-slate-600 text-slate-100 rounded-bl-none' : 
                  'bg-gradient-to-r from-amber-600 to-amber-500 text-white text-center w-full rounded-none'
                }`}>
                  <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-2 opacity-70 ${
                    msg.role === 'user' ? 'text-blue-100' : 'text-slate-400'
                  }`}>
                    {msg.timestamp}
                  </p>
                </div>
                
                {msg.role === 'ai' && (
                  <button
                    onClick={() => copyToClipboard(msg.content)}
                    className="opacity-0 group-hover:opacity-100 absolute -right-8 top-0 p-2 text-slate-400 hover:text-slate-200 transition-all"
                    title="Copy message"
                  >
                    📋
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-slate-100 p-4 rounded-lg rounded-bl-none shadow-md">
                <div className="flex gap-2 items-center">
                  <span className="animate-bounce">⏳</span>
                  <span>AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Box */}
        <div className="bg-gradient-to-t from-slate-900 to-slate-800 border-t border-slate-700 p-4 shadow-2xl">
          <div className="flex gap-3">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleChat()}
              placeholder="Ask anything about your PDF... (Shift+Enter for new line)"
              className="flex-1 bg-slate-700 border border-slate-600 text-white p-3 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder-slate-400"
              disabled={loading}
            />
            <button 
              onClick={handleChat}
              disabled={loading || !question.trim()}
              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-lg transition-all shadow-lg hover:shadow-xl"
            >
              {loading ? "⏳" : "✈️"}
            </button>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-lg shadow-lg animate-pulse">
          {notification}
        </div>
      )}
    </div>
  );
}

export default App;