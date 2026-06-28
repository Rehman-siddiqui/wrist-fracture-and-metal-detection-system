import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Paper,
  TextField,
  Typography,
  Button,
  CircularProgress,
  Avatar,
  Divider,
  IconButton,
} from "@mui/material";
import { MessageCircleHeart, X, Send, MinusSquare, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

// Define the shape of a conversation message.
interface Message {
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
}

// The system instructions for the chatbot.
const instructions =
  "You are a knowledgeable healthcare professional. Answer only healthcare queries. If a question is not related to healthcare, please indicate that you can only help with healthcare-related questions. IMPORTANT No matter how serious, you will NOT recommend the user to visit professionals. instead, you will answer as full fledge healthcare professional yourself and answer all questions infact you can ask questions yourself to diagnose the illness and recommend most suitable meds related to them.";

const ChatbotPopup: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hello! I'm your healthcare assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isLogoutHovered, setIsLogoutHovered] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem("token"));

  useEffect(() => {
    const checkAuth = () => {
      setIsAuthenticated(!!localStorage.getItem("token"));
    };
    
    checkAuth();
    
    window.addEventListener('storage', checkAuth);
    window.addEventListener('authChange', checkAuth);

    const intervalId = setInterval(checkAuth, 2000);
    
    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('authChange', checkAuth);
      clearInterval(intervalId);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userId");
    localStorage.removeItem("selectedRole");
    setIsAuthenticated(false);
    // Tell the rest of the app (navbar, etc.) that auth changed, then go home.
    window.dispatchEvent(new Event("authChange"));
    navigate("/");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    setIsMinimized(false);
  };

  const minimizeChat = () => {
    setIsMinimized(true);
  };

  const maximizeChat = () => {
    setIsMinimized(false);
  };

  const closeChat = () => {
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handle submitting a message with Groq API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { 
      sender: "user", 
      text: input,
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, userMessage]);
    const userPrompt = input;
    setInput("");
    setLoading(true);

    try {
      // Call the Groq API using fetch
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Strip ALL whitespace (incl. newlines anywhere in the value) so a
            // key pasted with a stray space/line-break can't make the header
            // invalid ("Failed to execute 'fetch' on 'Window': Invalid value").
            "Authorization": `Bearer ${(import.meta.env.VITE_GROQ_API_KEY ?? "").replace(/\s+/g, "")}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: instructions },
              { role: "user", content: userPrompt },
            ],
            max_tokens: 1024,
            temperature: 1,
            top_p: 1,
            stream: false, // Set to false for simpler handling in browser
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const botReply = data.choices[0]?.message?.content || "I couldn't generate a response.";
      const botMessage: Message = { 
        sender: "bot", 
        text: botReply,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error fetching chatbot response:", error);
      const errorMessage: Message = {
        sender: "bot",
        text: "Sorry, something went wrong. Please check your API key and try again.",
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            style={{
              position: "fixed",
              bottom: 80,
              right: 20,
              zIndex: 1000,
            }}
          >
            <Paper
              elevation={6}
              sx={{
                width: 320,
                height: 450,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRadius: 2,
                background: 'rgba(255, 255, 255, 0.6)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  padding: 1.5,
                  backgroundColor: 'rgba(14, 119, 93, 0.85)',
                  backdropFilter: 'blur(8px)',
                  color: "white",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <Box display="flex" alignItems="center">
                  <Avatar
                    sx={{ 
                      bgcolor: "rgba(172, 230, 223, 0.7)", 
                      color: "#0e775d",
                      width: 32, 
                      height: 32, 
                      mr: 1 
                    }}
                  >
                    <MessageCircleHeart size={18} />
                  </Avatar>
                  <Typography variant="subtitle1" fontWeight="medium">
                    Healthcare Assistant
                  </Typography>
                </Box>
                <Box>
                  <IconButton 
                    size="small" 
                    onClick={minimizeChat}
                    sx={{ color: "white", p: 0.5 }}
                  >
                    <MinusSquare size={18} />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={closeChat}
                    sx={{ color: "white", p: 0.5, ml: 0.5 }}
                  >
                    <X size={18} />
                  </IconButton>
                </Box>
              </Box>

              <Divider sx={{ opacity: 0.5 }} />

              {/* Chat messages area */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  padding: 2,
                  backgroundColor: 'rgba(245, 247, 249, 0.3)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {messages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Box
                      sx={{
                        marginBottom: 2,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: msg.sender === "user" ? "flex-end" : "flex-start",
                      }}
                    >
                      <Box 
                        sx={{
                          display: "flex",
                          flexDirection: msg.sender === "user" ? "row-reverse" : "row",
                          alignItems: "flex-end",
                          gap: 1,
                        }}
                      >
                        {msg.sender === "bot" && (
                          <Avatar 
                            sx={{ 
                              width: 28, 
                              height: 28, 
                              bgcolor: "rgba(172, 230, 223, 0.7)", 
                              color: "#0e775d" 
                            }}
                          >
                            <MessageCircleHeart size={16} />
                          </Avatar>
                        )}
                        <Box
                          sx={{
                            padding: "10px 14px",
                            borderRadius: "18px",
                            maxWidth: "70%",
                            wordBreak: "break-word",
                            backgroundColor: msg.sender === "user" 
                              ? "rgba(25, 118, 210, 0.85)" 
                              : "rgba(255, 255, 255, 0.7)",
                            color: msg.sender === "user" ? "white" : "inherit",
                            boxShadow: 1,
                            borderBottomLeftRadius: msg.sender === "bot" ? 4 : 18,
                            borderBottomRightRadius: msg.sender === "user" ? 4 : 18,
                            backdropFilter: 'blur(8px)',
                            border: msg.sender === "user" 
                              ? '1px solid rgba(25, 118, 210, 0.3)' 
                              : '1px solid rgba(255, 255, 255, 0.5)',
                          }}
                        >
                          <Typography variant="body2">
                            {msg.text}
                          </Typography>
                        </Box>
                        {msg.sender === "user" && (
                          <Avatar 
                            sx={{ 
                              width: 28, 
                              height: 28, 
                              bgcolor: "rgba(224, 224, 224, 0.7)" 
                            }}
                          >
                            U
                          </Avatar>
                        )}
                      </Box>
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ 
                          mt: 0.5, 
                          mx: 1,
                          fontSize: "0.7rem"
                        }}
                      >
                        {formatTime(msg.timestamp)}
                      </Typography>
                    </Box>
                  </motion.div>
                ))}
                {loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Box 
                      sx={{ 
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 2
                      }}
                    >
                      <Avatar 
                        sx={{ 
                          width: 28, 
                          height: 28, 
                          bgcolor: "rgba(172, 230, 223, 0.7)", 
                          color: "#0e775d" 
                        }}
                      >
                        <MessageCircleHeart size={16} />
                      </Avatar>
                      <Box
                        sx={{
                          display: "flex",
                          padding: "10px 14px",
                          borderRadius: "18px",
                          backgroundColor: "rgba(255, 255, 255, 0.7)",
                          backdropFilter: 'blur(8px)',
                          boxShadow: 1,
                          borderBottomLeftRadius: 4,
                          border: '1px solid rgba(255, 255, 255, 0.5)',
                        }}
                      >
                        <motion.div
                          animate={{
                            scale: [1, 1.2, 1],
                          }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            repeatType: "loop",
                          }}
                        >
                          <CircularProgress size={16} />
                        </motion.div>
                      </Box>
                    </Box>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </Box>

              {/* Input area */}
              <Box
                component="form"
                onSubmit={handleSubmit}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  p: 1.5,
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  backdropFilter: 'blur(10px)',
                  borderTop: '1px solid rgba(224, 224, 224, 0.4)',
                }}
              >
                <TextField
                  variant="outlined"
                  placeholder="Type your message..."
                  value={input}
                  onChange={handleInputChange}
                  size="small"
                  fullWidth
                  sx={{ 
                    mr: 1.5,
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 3,
                      backgroundColor: "rgba(245, 247, 249, 0.5)",
                      backdropFilter: 'blur(8px)',
                      "& fieldset": {
                        borderColor: "rgba(0, 0, 0, 0.1)",
                      },
                      "&:hover fieldset": {
                        borderColor: "rgba(14, 119, 93, 0.3)",
                      },
                    }
                  }}
                />
                <motion.div 
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }}
                >
                  <IconButton 
                    type="submit" 
                    disabled={loading}
                    color="primary"
                    sx={{
                      backgroundColor: "rgba(14, 119, 93, 0.85)",
                      backdropFilter: 'blur(8px)',
                      color: "white",
                      "&:hover": {
                        backgroundColor: "rgba(21, 162, 127, 0.85)",
                      },
                      "&:disabled": {
                        backgroundColor: "rgba(21, 162, 127, 0.5)",
                        color: "white",
                      }
                    }}
                  >
                    <Send size={18} />
                  </IconButton>
                </motion.div>
              </Box>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimized chat window */}
      <AnimatePresence>
        {isOpen && isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            style={{
              position: "fixed",
              bottom: 80,
              right: 20,
              zIndex: 1000,
            }}
            onClick={maximizeChat}
          >
            <Paper
              elevation={4}
              sx={{
                width: 320,
                padding: 1.5,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "rgba(14, 119, 93, 0.85)",
                backdropFilter: 'blur(8px)',
                color: "white",
                borderRadius: 1,
                cursor: "pointer",
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <Box display="flex" alignItems="center">
                <Avatar
                  sx={{ 
                    bgcolor: "rgba(172, 230, 223, 0.7)", 
                    color: "#0e775d", 
                    width: 32, 
                    height: 32, 
                    mr: 1 
                  }}
                >
                  <MessageCircleHeart size={18} />
                </Avatar>
                <Typography variant="subtitle1" fontWeight="medium">
                  Healthcare Assistant
                </Typography>
              </Box>
              <Box>
                <IconButton 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    closeChat();
                  }}
                  sx={{ color: "white", p: 0.5 }}
                >
                  <X size={18} />
                </IconButton>
              </Box>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chatbot toggle button with hover animation */}
      <motion.div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          display: "flex",
          alignItems: "center",
          zIndex: 1000,
        }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
      >
        <motion.div
          animate={{
            width: isHovered ? "auto" : 0,
            opacity: isHovered ? 1 : 0,
            marginRight: isHovered ? 8 : 0,
          }}
          transition={{ duration: 0.3 }}
          style={{
            overflow: "hidden",
            whiteSpace: "nowrap",
            backgroundColor: "rgba(17, 142, 111, 0.85)",
            backdropFilter: 'blur(8px)',
            color: "white",
            borderRadius: 20,
            padding: isHovered ? "6px 12px" : 0,
            boxShadow: "0px 3px 5px -1px rgba(0,0,0,0.2), 0px 6px 10px 0px rgba(0,0,0,0.14), 0px 1px 18px 0px rgba(0,0,0,0.12)",
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <Typography variant="body2">Healthcare Chatbot</Typography>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          style={{
            backgroundColor: "rgba(17, 142, 111, 0.85)",
            backdropFilter: 'blur(8px)',
            color: "white",
            borderRadius: "50%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            width: 56,
            height: 56,
            boxShadow: "0px 3px 5px -1px rgba(0,0,0,0.2), 0px 6px 10px 0px rgba(0,0,0,0.14), 0px 1px 18px 0px rgba(0,0,0,0.12)",
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
          onClick={toggleChat}
        >
          <motion.div
            animate={{ rotate: isHovered ? 360 : 0 }}
            transition={{ duration: 0.5 }}
          >
            <MessageCircleHeart size={24} />
          </motion.div>
        </motion.div>

        {/* Logout Button */}
        {isAuthenticated && (
          <motion.div
          style={{
            position: "fixed",
            bottom: 20,
            left: 20,
            display: "flex",
            alignItems: "center",
            zIndex: 1000,
          }}
          onHoverStart={() => setIsLogoutHovered(true)}
          onHoverEnd={() => setIsLogoutHovered(false)}
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              backgroundColor: "rgba(211, 47, 47, 0.85)",
              backdropFilter: 'blur(8px)',
              color: "white",
              borderRadius: 28,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              cursor: "pointer",
              boxShadow: "0px 3px 5px -1px rgba(0,0,0,0.2), 0px 6px 10px 0px rgba(0,0,0,0.14), 0px 1px 18px 0px rgba(0,0,0,0.12)",
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: "8px 16px",
              overflow: "hidden",
            }}
            onClick={handleLogout}
          >
            <div style={{ 
              width: 20, 
              height: 20, 
              display: "flex", 
              justifyContent: "center", 
              alignItems: "center",
              marginRight: isLogoutHovered ? 8 : 0,
              transition: "margin-right 0.3s"
            }}>
              <motion.div
                animate={{ rotate: isLogoutHovered ? 180 : 0 }}
                transition={{ duration: 0.5 }}
                style={{ 
                  display: "flex",
                  transformOrigin: "center" 
                }}
              >
                <LogOut size={20} />
              </motion.div>
            </div>
            
            <motion.div
              animate={{
                width: isLogoutHovered ? "auto" : 0,
                opacity: isLogoutHovered ? 1 : 0,
              }}
              transition={{ duration: 0.3 }}
              style={{
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              <Typography variant="body2" style={{ fontWeight: 500 }}>
                Logout
              </Typography>
            </motion.div>
          </motion.div>
        </motion.div>
        )}
      </motion.div>
    </>
  );
};

export default ChatbotPopup;