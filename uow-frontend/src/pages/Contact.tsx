import { FunctionComponent, useState } from "react";
import { motion } from "framer-motion";
import { 
  Mail, 
  Send,
  Clock,
  MessageSquare,
  CheckCircle2,
  Linkedin,
  Github,
  GraduationCap
} from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

// Backend API base URL — configurable via VITE_API_URL for deployment.
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const contactReasons = [
  { value: "demo", label: "Request a Demo" },
  { value: "feedback", label: "Feedback & Suggestions" },
  { value: "collaboration", label: "Research Collaboration" },
  { value: "technical", label: "Technical Questions" },
  { value: "other", label: "Other" }
];

const Contact: FunctionComponent = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organization: "",
    reason: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail = data?.detail;
        throw new Error(typeof detail === "string" ? detail : "Failed to send message");
      }
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Could not send your message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#0a1628] text-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4 sm:px-8 lg:px-16 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-block px-4 py-2 mb-6 text-sm font-medium text-emerald-400 bg-emerald-400/10 rounded-full border border-emerald-400/20">
              Get in Touch
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              We'd Love to{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500">
                Hear From You
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
              Have questions about our AI diagnostic tool? Want to provide feedback or discuss collaboration? 
              Send us a message and we'll get back to you.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-12 px-4 sm:px-8 lg:px-16">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Contact Form */}
            <motion.div 
              className="lg:col-span-3"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="p-8 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50">
                {isSubmitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-12"
                  >
                    <CheckCircle2 className="w-16 h-16 mx-auto mb-6 text-emerald-400" />
                    <h3 className="text-2xl font-bold mb-4">Message Sent!</h3>
                    <p className="text-slate-400 mb-8">
                      Thank you for reaching out. We'll review your message and get back to you soon.
                    </p>
                    <button
                      onClick={() => {
                        setIsSubmitted(false);
                        setFormData({ name: "", email: "", organization: "", reason: "", message: "" });
                      }}
                      className="px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
                    >
                      Send Another Message
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Your Name *
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                          placeholder="Your name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                          placeholder="your@email.com"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Organization (Optional)
                        </label>
                        <input
                          type="text"
                          name="organization"
                          value={formData.organization}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                          placeholder="University / Hospital / Company"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Reason for Contact *
                        </label>
                        <select
                          name="reason"
                          value={formData.reason}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition-colors appearance-none cursor-pointer"
                        >
                          <option value="" disabled>Select an option</option>
                          {contactReasons.map(reason => (
                            <option key={reason.value} value={reason.value}>
                              {reason.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Message *
                      </label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows={5}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                        placeholder="Tell us what's on your mind..."
                      />
                    </div>

                    {error && (
                      <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
                        {error}
                      </div>
                    )}

                    <motion.button
                      type="submit"
                      disabled={isSubmitting}
                      whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                      whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                      className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Send Message
                        </>
                      )}
                    </motion.button>
                  </form>
                )}
              </div>
            </motion.div>

            {/* Contact Info */}
            <motion.div 
              className="lg:col-span-2 space-y-6"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {/* Project Info */}
              <div className="p-6 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 backdrop-blur-sm rounded-2xl border border-emerald-500/20">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-emerald-400" />
                  About This Project
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Wrist Fracture and Metal Detection System is a Final Year Project developed at the Hamdard University. 
                  This AI-powered tool analyzes wrist X-rays to detect fractures and metal implants, 
                  demonstrating the potential of deep learning in medical imaging.
                </p>
              </div>

              {/* Quick Contact */}
              <div className="p-6 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-teal-400" />
                  Quick Contact
                </h3>
                <div className="space-y-4">
                  <a href="mailto:contact@wristfracture.ai" className="flex items-center gap-3 text-slate-300 hover:text-emerald-400 transition-colors">
                    <Mail className="w-5 h-5" />
                    contact@wristfracture.ai
                  </a>
                </div>
              </div>

              {/* Connect */}
              <div className="p-6 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50">
                <h3 className="text-lg font-semibold mb-4">Connect With Us</h3>
                <div className="flex gap-4">
                  <a href="#" className="w-12 h-12 bg-slate-700/50 rounded-xl flex items-center justify-center hover:bg-emerald-500/20 hover:text-emerald-400 transition-all">
                    <Github className="w-5 h-5" />
                  </a>
                  <a href="#" className="w-12 h-12 bg-slate-700/50 rounded-xl flex items-center justify-center hover:bg-emerald-500/20 hover:text-emerald-400 transition-all">
                    <Linkedin className="w-5 h-5" />
                  </a>
                </div>
              </div>

              {/* Response Note */}
              <div className="p-6 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Note</h3>
                    <p className="text-slate-400 text-sm">
                      This is an academic project. Response times may vary based on our project timeline.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;

