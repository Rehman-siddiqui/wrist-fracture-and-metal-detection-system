import { useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, Building, GraduationCap, Shield, AlertCircle, Building2 } from "lucide-react";
import { Button } from "@mui/material";

// Backend API base URL — configurable via VITE_API_URL for deployment.
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Define the Protected Route component
interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem("token");

  useEffect(() => {
    if (!isAuthenticated) {
      if (!localStorage.getItem("selectedRole")) {
        navigate("/select-role");
      } else {
        navigate("/signin");
      }
    }
  }, [isAuthenticated, navigate]);

  return isAuthenticated ? <>{children}</> : null;
};

// Custom Input Component
interface InputProps {
  type: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
  placeholder?: string;
}

const Input: React.FC<InputProps> = ({ type, label, value, onChange, icon, placeholder }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </div>
        )}
        <input
          type={isPassword && showPassword ? "text" : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`
            w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white
            placeholder-slate-500 transition-all duration-300
            focus:outline-none focus:border-teal-400 focus:bg-white/10
            ${icon ? 'pl-12' : ''}
            ${isPassword ? 'pr-12' : ''}
          `}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="animate-blink absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
};

// Role-based redirect helper
const getRedirectPath = (role: string): string => {
  switch (role) {
    case "admin":
      return "/admin";
    case "hospital":
      return "/hospital";
    case "client":
    default:
      return "/start";
  }
};

// Sign In Page
export const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [role, setRole] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const storedRole = localStorage.getItem("selectedRole");
    if (storedRole) {
      setRole(storedRole);
    } else {
      navigate("/select-role");
    }
  }, [navigate]);

  const getRoleName = (roleKey: string): string => {
    const roleMap: Record<string, string> = {
      "client": "Client",
      "admin": "Admin",
      "hospital": "Hospital Staff"
    };
    return roleMap[roleKey] || roleKey.charAt(0).toUpperCase() + roleKey.slice(1);
  };

  const getRoleIcon = (roleKey: string) => {
    switch (roleKey) {
      case "client": return <GraduationCap className="w-5 h-5" />;
      case "admin": return <Shield className="w-5 h-5" />;
      case "hospital": return <Building2 className="w-5 h-5" />;
      default: return <User className="w-5 h-5" />;
    }
  };

  const handleSuccessfulLogin = (token: string, userRole: string, userId: number) => {
    localStorage.setItem("token", token);
    localStorage.setItem("userRole", userRole);
    localStorage.setItem("userId", userId.toString());
    
    const authChangeEvent = new Event('authChange');
    window.dispatchEvent(authChangeEvent);
    
    // Redirect based on role
    navigate(getRedirectPath(userRole));
  };

  const handleSignIn = async () => {
    setError("");
    setIsLoading(true);
    
    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);
      if (role) {
        formData.append("role", role);
      }
      
      const response = await fetch(`${API_BASE}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Login failed");
      }
      
      const data = await response.json();
      handleSuccessfulLogin(data.access_token, data.role, data.user_id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!role) return null;

  return (
    <div className="min-h-screen gradient-primary relative overflow-hidden flex items-center justify-center px-4 py-8">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Back button */}
        <Button
          onClick={() => navigate("/select-role")}
          className="flex items-center gap-2 text-white transition-colors mb-6 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
          variant="contained"
          color="primary"
          size="small"
        >
          Change Role
        </Button> 

        {/* Card */}
        <div className="bg-[#0f1f35]/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-slate-700/50">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-teal-500/20 px-4 py-2 rounded-full mb-4 text-teal-300">
              {getRoleIcon(role)}
              <span className="text-sm font-medium">{getRoleName(role)}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-slate-400">Sign in to continue to Wrist Fracture and Metal Detection System</p>
          </div>

          {/* Error Alert */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <div className="space-y-5">
            <Input
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-5 h-5" />}
              placeholder="Enter your email"
            />

            <Input
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-5 h-5" />}
              placeholder="Enter your password"
            />

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full py-3 px-6 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </motion.button>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-slate-400">
              Don't have an account?{' '}
              <button
                onClick={() => navigate("/signup")}
                className="text-teal-400 hover:text-teal-300 font-medium transition-colors underline-offset-2 hover:underline"
              >
                Sign Up
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Hospital type for dropdown
interface HospitalOption {
  id: number;
  name: string;
  code: string;
}

// Sign Up Page
export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [role, setRole] = useState<string>("");
  const [roleFields, setRoleFields] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  
  // Hospital-specific state
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("");
  const [isCreatingNewHospital, setIsCreatingNewHospital] = useState(false);
  const [newHospital, setNewHospital] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    email: ""
  });
  const [loadingHospitals, setLoadingHospitals] = useState(false);

  // Client hospital preference
  const [clientPreferredHospital, setClientPreferredHospital] = useState<string>("");

  useEffect(() => {
    const storedRole = localStorage.getItem("selectedRole");
    if (storedRole) {
      setRole(storedRole);
      if (storedRole === "client") {
        setRoleFields({ clientId: "", organization: "" });
        // Also fetch hospitals for client preference
        fetchHospitals();
      } else if (storedRole === "admin") {
        setRoleFields({ adminId: "", department: "" });
      } else if (storedRole === "hospital") {
        setRoleFields({ hospitalId: "", department: "", position: "" });
        // Fetch hospitals list
        fetchHospitals();
      }
    } else {
      navigate("/select-role");
    }
  }, [navigate]);

  const fetchHospitals = async () => {
    setLoadingHospitals(true);
    try {
      const response = await fetch(`${API_BASE}/hospitals/list`);
      if (response.ok) {
        const data = await response.json();
        setHospitals(data);
      }
    } catch (err) {
      console.error("Failed to fetch hospitals:", err);
    } finally {
      setLoadingHospitals(false);
    }
  };

  const getRoleName = (roleKey: string): string => {
    const roleMap: Record<string, string> = {
      "client": "Client",
      "admin": "Admin",
      "hospital": "Hospital Staff"
    };
    return roleMap[roleKey] || roleKey.charAt(0).toUpperCase() + roleKey.slice(1);
  };

  const getRoleIcon = (roleKey: string) => {
    switch (roleKey) {
      case "client": return <GraduationCap className="w-5 h-5" />;
      case "admin": return <Shield className="w-5 h-5" />;
      case "hospital": return <Building2 className="w-5 h-5" />;
      default: return <User className="w-5 h-5" />;
    }
  };

  const handleRoleFieldChange = (field: string, value: string) => {
    setRoleFields({ ...roleFields, [field]: value });
  };

  const validateForm = (): boolean => {
    if (!email || !password || !confirmPassword || !name) {
      setError("All fields are required");
      return false;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }

    // Hospital-specific validation
    if (role === "hospital") {
      if (!isCreatingNewHospital && !selectedHospitalId) {
        setError("Please select a hospital or create a new one");
        return false;
      }
      if (isCreatingNewHospital && !newHospital.name) {
        setError("Hospital name is required");
        return false;
      }
    }
    
    return true;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;
    
    setError("");
    setIsLoading(true);
    
    try {
      const signupData: any = {
        email,
        password,
        role,
        name,
      };

      // Add role-specific fields
      if (role === "client") {
        signupData.clientId = roleFields.clientId || undefined;
        signupData.organization = roleFields.organization || undefined;
        // Add preferred hospital if selected
        if (clientPreferredHospital) {
          signupData.preferredHospitalId = parseInt(clientPreferredHospital);
        }
      } else if (role === "admin") {
        signupData.adminId = roleFields.adminId || undefined;
        signupData.department = roleFields.department || undefined;
      } else if (role === "hospital") {
        signupData.hospitalId = roleFields.hospitalId || undefined;
        signupData.department = roleFields.department || undefined;
        signupData.position = roleFields.position || undefined;
        
        if (isCreatingNewHospital) {
          // Creating a new hospital
          signupData.newHospitalName = newHospital.name;
          signupData.newHospitalCode = newHospital.code || undefined;
          signupData.newHospitalAddress = newHospital.address || undefined;
          signupData.newHospitalPhone = newHospital.phone || undefined;
          signupData.newHospitalEmail = newHospital.email || undefined;
        } else {
          // Selecting existing hospital
          signupData.hospitalEntityId = parseInt(selectedHospitalId);
        }
      }
  
      const response = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signupData),
      });
  
      if (!response.ok) {
        if (response.headers.get("content-type")?.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.detail || JSON.stringify(errorData));
        } else {
          throw new Error(`Server error: ${response.status}`);
        }
      }
  
      // Success - redirect to sign in
      navigate("/signin");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderRoleFields = () => {
    if (role === "client") {
      return (
        <>
          <Input
            type="text"
            label="Client ID (optional)"
            value={roleFields.clientId || ""}
            onChange={(e) => handleRoleFieldChange("clientId", e.target.value)}
            placeholder="Enter your client ID"
          />
          <Input
            type="text"
            label="Organization (optional)"
            value={roleFields.organization || ""}
            onChange={(e) => handleRoleFieldChange("organization", e.target.value)}
            placeholder="Enter your organization"
          />
          
          {/* Hospital Selection for Clients */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Preferred Hospital (optional)
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Select a hospital if you want to be associated with one
            </p>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
                value={clientPreferredHospital}
                onChange={(e) => setClientPreferredHospital(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white appearance-none cursor-pointer focus:outline-none focus:border-teal-400 focus:bg-white/10 transition-all"
                disabled={loadingHospitals}
              >
                <option value="" className="bg-slate-800">
                  {loadingHospitals ? "Loading..." : "No preference / Skip"}
                </option>
                {hospitals.map((hospital) => (
                  <option key={hospital.id} value={hospital.id} className="bg-slate-800">
                    {hospital.name} ({hospital.code})
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </>
      );
    } else if (role === "admin") {
      return (
        <>
          <Input
            type="text"
            label="Admin ID (optional)"
            value={roleFields.adminId || ""}
            onChange={(e) => handleRoleFieldChange("adminId", e.target.value)}
            placeholder="Enter your admin ID"
          />
          <Input
            type="text"
            label="Department (optional)"
            value={roleFields.department || ""}
            onChange={(e) => handleRoleFieldChange("department", e.target.value)}
            placeholder="Enter your department"
          />
        </>
      );
    } else if (role === "hospital") {
      return (
        <>
          {/* Hospital Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Hospital Association</label>
            
            {/* Toggle between select existing or create new */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setIsCreatingNewHospital(false)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  !isCreatingNewHospital
                    ? "bg-teal-500/30 text-teal-300 border border-teal-500/50"
                    : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                }`}
              >
                Select Existing
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingNewHospital(true)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  isCreatingNewHospital
                    ? "bg-teal-500/30 text-teal-300 border border-teal-500/50"
                    : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                }`}
              >
                Create New
              </button>
            </div>

            {!isCreatingNewHospital ? (
              /* Select existing hospital dropdown */
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <select
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white appearance-none cursor-pointer focus:outline-none focus:border-teal-400 focus:bg-white/10 transition-all"
                  disabled={loadingHospitals}
                >
                  <option value="" className="bg-slate-800">
                    {loadingHospitals ? "Loading hospitals..." : "Select a hospital..."}
                  </option>
                  {hospitals.map((hospital) => (
                    <option key={hospital.id} value={hospital.id} className="bg-slate-800">
                      {hospital.name} ({hospital.code})
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            ) : (
              /* Create new hospital form */
              <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/10">
                <p className="text-xs text-slate-400 mb-2">Create a new hospital association</p>
                <input
                  type="text"
                  value={newHospital.name}
                  onChange={(e) => setNewHospital({ ...newHospital, name: e.target.value })}
                  placeholder="Hospital Name *"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 text-sm"
                />
                <input
                  type="text"
                  value={newHospital.code}
                  onChange={(e) => setNewHospital({ ...newHospital, code: e.target.value })}
                  placeholder="Hospital Code (e.g., HSP-001)"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 text-sm"
                />
                <input
                  type="email"
                  value={newHospital.email}
                  onChange={(e) => setNewHospital({ ...newHospital, email: e.target.value })}
                  placeholder="Hospital Email"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 text-sm"
                />
                <input
                  type="tel"
                  value={newHospital.phone}
                  onChange={(e) => setNewHospital({ ...newHospital, phone: e.target.value })}
                  placeholder="Hospital Phone"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 text-sm"
                />
                <textarea
                  value={newHospital.address}
                  onChange={(e) => setNewHospital({ ...newHospital, address: e.target.value })}
                  placeholder="Hospital Address"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 text-sm resize-none"
                />
              </div>
            )}
          </div>

          {/* Staff details */}
          <Input
            type="text"
            label="Staff ID (optional)"
            value={roleFields.hospitalId || ""}
            onChange={(e) => handleRoleFieldChange("hospitalId", e.target.value)}
            placeholder="Enter your staff ID"
          />
          <Input
            type="text"
            label="Department (optional)"
            value={roleFields.department || ""}
            onChange={(e) => handleRoleFieldChange("department", e.target.value)}
            placeholder="Enter your department"
          />
          <Input
            type="text"
            label="Position (optional)"
            value={roleFields.position || ""}
            onChange={(e) => handleRoleFieldChange("position", e.target.value)}
            placeholder="Enter your position"
          />
        </>
      );
    }
    return null;
  };

  if (!role) return null;

  return (
    <div className="min-h-screen gradient-primary relative overflow-hidden flex items-center justify-center px-4 py-8">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Back button */}
        <Button
          onClick={() => navigate("/select-role")}
          className="flex items-center gap-2 text-white transition-colors mb-6 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
          variant="contained"
          color="primary"
          size="small"
        >
          Change Role
        </Button>

        {/* Card */}
        <div className="bg-[#0f1f35]/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-slate-700/50">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-teal-500/20 px-4 py-2 rounded-full mb-4 text-teal-300">
              {getRoleIcon(role)}
              <span className="text-sm font-medium">{getRoleName(role)}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-slate-400">Join Wrist Fracture and Metal Detection System today</p>
          </div>

          {/* Error Alert */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <div className="space-y-4">
            <Input
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-5 h-5" />}
              placeholder="Enter your email"
            />

            <Input
              type="text"
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              icon={<User className="w-5 h-5" />}
              placeholder="Enter your full name"
            />

            <Input
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-5 h-5" />}
              placeholder="Create a password"
            />

            <Input
              type="password"
              label="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={<Lock className="w-5 h-5" />}
              placeholder="Confirm your password"
            />

            {/* Role-specific fields */}
            {renderRoleFields()}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSignUp}
              disabled={isLoading}
              className="w-full py-3 px-6 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </motion.button>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-slate-400">
              Already have an account?{' '}
              <Button
                onClick={() => navigate("/signin")}
                variant="contained"
                color="primary"
                size="small"
                className="text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 font-medium transition-colors underline-offset-2 hover:underline"
              >
                Sign In
              </Button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Start Analyzing Button Handler
export const handleStartAnalyzing = (navigate: (path: string) => void): void => {
  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("userRole");
  
  if (token) {
    // Redirect based on role
    if (userRole === "admin") {
      navigate("/admin");
    } else if (userRole === "hospital") {
      navigate("/hospital");
    } else {
      navigate("/start");
    }
  } else {
    navigate("/select-role");
  }
};

export default ProtectedRoute;
