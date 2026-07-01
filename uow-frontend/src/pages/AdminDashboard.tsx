import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Users, Building2, Activity, Settings, Search, Plus, Edit2, Trash2,
  UserPlus, Shield, X, Check, AlertCircle, ChevronDown, LogOut,
  RefreshCw, Eye, Key, UserMinus, Link2, Unlink,
  FileText, Download, MessageSquare, Upload, Mail
} from "lucide-react";

// Types
interface DashboardStats {
  total_users: number;
  total_clients: number;
  total_hospitals: number;
  total_admins: number;
  total_hospital_entities: number;
  total_analyses: number;
  active_users: number;
  inactive_users: number;
}

interface User {
  id: number;
  email: string;
  name: string | null;
  role: string;
  status: string;
  created_at: string;
  profile?: any;
}

interface Hospital {
  id: number;
  name: string;
  code: string;
  email: string | null;
  is_active: boolean;
  staff_count: number;
  client_count: number;
}

interface UnassignedClient {
  client_profile_id: number;
  user_id: number;
  client_id: string;
  name: string | null;
  email: string;
  organization: string | null;
}

interface AssignedHospital {
  assignment_id: number;
  hospital_id: number;
  hospital_name: string;
  hospital_code: string;
  assigned_at: string | null;
}

interface ClientWithAssignments {
  client_profile_id: number;
  user_id: number;
  client_id: string;
  name: string | null;
  email: string;
  organization: string | null;
  status: string;
  assigned_hospitals: AssignedHospital[];
}

interface AnalysisRecord {
  id: number;
  user_id: number;
  user_name: string | null;
  user_email: string | null;
  hospital_id: number | null;
  hospital_name: string | null;
  image_type: string;
  original_filename: string;
  processed_filename: string | null;
  report_filename: string | null;
  detections: string | null;
  created_at: string | null;
}

interface ContactMessageItem {
  id: number;
  name: string;
  email: string;
  organization: string | null;
  reason: string | null;
  message: string;
  is_read: boolean;
  created_at: string | null;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Render a stored UTC timestamp in the viewer's local date/time.
const formatDateTime = (s?: string | null): string => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString();
};

// AnalysisHistory.detections is stored as a JSON string; parse it safely.
const parseDetections = (s?: string | null): Array<{ class_name: string; confidence: number }> => {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

// Turn a FastAPI error body into a plain string. FastAPI returns `detail` as a
// STRING for HTTPExceptions but as an ARRAY of objects for 422 validation
// errors. Rendering that array straight into JSX crashes React with "Objects
// are not valid as a React child" (a blank white screen), so every error path
// must normalise it through here first.
const extractErrorMessage = (data: any, fallback: string): string => {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msg = detail
      .map((e) => (e && typeof e === "object" ? e.msg : String(e)))
      .filter(Boolean)
      .join(", ");
    return msg || fallback;
  }
  if (detail && typeof detail === "object") return detail.msg || fallback;
  return fallback;
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "hospitals" | "assignments" | "analyze" | "analyses" | "messages">("overview");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [unassignedClients, setUnassignedClients] = useState<UnassignedClient[]>([]);
  const [allClients, setAllClients] = useState<ClientWithAssignments[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState("");
  const [hospitalFilter, setHospitalFilter] = useState<string>("");
  
  // Modals
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showCreateHospitalModal, setShowCreateHospitalModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedClient, setSelectedClient] = useState<UnassignedClient | null>(null);
  const [selectedClientForReassign, setSelectedClientForReassign] = useState<ClientWithAssignments | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignedHospital | null>(null);

  // Analyses viewer
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [analysisHospitalFilter, setAnalysisHospitalFilter] = useState<string>("");
  const [analysisUserFilter, setAnalysisUserFilter] = useState<string>("");

  // Contact messages
  const [messages, setMessages] = useState<ContactMessageItem[]>([]);

  // Admin "Analyze X-Ray" tab
  const [analyzeProcessing, setAnalyzeProcessing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<any | null>(null);

  const token = localStorage.getItem("token");

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (response.status === 401) {
      localStorage.removeItem("token");
      navigate("/signin");
      throw new Error("Unauthorized");
    }
    return response;
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, hospitalsRes, unassignedRes, allClientsRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/admin/dashboard/stats`),
        fetchWithAuth(`${API_BASE}/admin/users?${roleFilter ? `role=${roleFilter}` : ""}&${searchQuery ? `search=${searchQuery}` : ""}`),
        fetchWithAuth(`${API_BASE}/admin/hospitals`),
        fetchWithAuth(`${API_BASE}/admin/clients/unassigned`),
        fetchWithAuth(`${API_BASE}/admin/clients/all?${assignmentSearchQuery ? `search=${assignmentSearchQuery}` : ""}${hospitalFilter ? `&hospital_filter=${hospitalFilter}` : ""}`),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (hospitalsRes.ok) setHospitals(await hospitalsRes.json());
      if (unassignedRes.ok) setUnassignedClients(await unassignedRes.json());
      if (allClientsRes.ok) setAllClients(await allClientsRes.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [roleFilter, searchQuery, assignmentSearchQuery, hospitalFilter]);

  const loadAnalyses = async () => {
    try {
      const params = new URLSearchParams();
      if (analysisHospitalFilter) params.append("hospital_id", analysisHospitalFilter);
      if (analysisUserFilter) params.append("user_id", analysisUserFilter);
      const res = await fetchWithAuth(`${API_BASE}/admin/analyses?${params.toString()}`);
      if (res.ok) setAnalyses(await res.json());
    } catch {
      /* non-fatal */
    }
  };

  const loadMessages = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/contacts`);
      if (res.ok) setMessages(await res.json());
    } catch {
      /* non-fatal */
    }
  };

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAnalyses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisHospitalFilter, analysisUserFilter]);

  const handleAdminAnalyze = async (file: File) => {
    setAnalyzeError(null);
    setAnalyzeResult(null);
    setAnalyzeProcessing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/xray/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data, "Analysis failed"));
      setAnalyzeResult(data);

      // Record the analysis so the dashboard "Total Analyses" count increments.
      const rd = new FormData();
      rd.append("image_type", "xray");
      rd.append("original_filename", file.name);
      if (data.processed_image_url) rd.append("processed_filename", data.processed_image_url);
      rd.append("detections", JSON.stringify(data.detections || []));
      await fetch(`${API_BASE}/analysis/record`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: rd,
      });

      // Refresh stats + the analyses list so both reflect the new analysis.
      loadDashboardData();
      loadAnalyses();
    } catch (err: any) {
      setAnalyzeError(err?.message || "Analysis failed");
    } finally {
      setAnalyzeProcessing(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    navigate("/select-role");
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/admin/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        loadDashboardData();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to delete user");
      }
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    const newStatus = user.status === "active" ? "inactive" : "active";
    try {
      const res = await fetchWithAuth(`${API_BASE}/admin/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        loadDashboardData();
      }
    } catch (err) {
      alert("Failed to update user status");
    }
  };

  const handleDeleteHospital = async (hospitalId: number) => {
    if (!confirm("Are you sure you want to delete this hospital?")) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/admin/hospitals/${hospitalId}`, { method: "DELETE" });
      if (res.ok) {
        loadDashboardData();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to delete hospital");
      }
    } catch (err) {
      alert("Failed to delete hospital");
    }
  };

  const handleAssignClient = async (clientId: number, hospitalId: number) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/admin/assignments`, {
        method: "POST",
        body: JSON.stringify({ client_id: clientId, hospital_id: hospitalId }),
      });
      if (res.ok) {
        setShowAssignModal(false);
        loadDashboardData();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to assign client");
      }
    } catch (err) {
      alert("Failed to assign client");
    }
  };

  const handleReassignClient = async (assignmentId: number, newHospitalId: number) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/admin/assignments/${assignmentId}?new_hospital_id=${newHospitalId}`, {
        method: "PUT",
      });
      if (res.ok) {
        setShowReassignModal(false);
        setSelectedClientForReassign(null);
        setSelectedAssignment(null);
        loadDashboardData();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to reassign client");
      }
    } catch (err) {
      alert("Failed to reassign client");
    }
  };

  const handleRemoveAssignment = async (assignmentId: number) => {
    if (!confirm("Are you sure you want to remove this client from the hospital?")) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/admin/assignments/${assignmentId}`, { method: "DELETE" });
      if (res.ok) {
        loadDashboardData();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to remove assignment");
      }
    } catch (err) {
      alert("Failed to remove assignment");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Admin Dashboard</h1>
                <p className="text-xs text-slate-400">Wrist Fracture and Metal Detection System</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={loadDashboardData}
                className="p-2 text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-slate-800/30 border-b border-slate-700/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-2">
            {[
              { id: "overview", label: "Overview", icon: Activity },
              { id: "analyze", label: "Analyze X-Ray", icon: Upload },
              { id: "analyses", label: "Analyses", icon: FileText },
              { id: "users", label: "Users", icon: Users },
              { id: "hospitals", label: "Hospitals", icon: Building2 },
              { id: "assignments", label: "Assignments", icon: Link2 },
              { id: "messages", label: "Messages", icon: MessageSquare },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-300">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatsCard
                  title="Total Users"
                  value={stats?.total_users || 0}
                  icon={Users}
                  color="purple"
                />
                <StatsCard
                  title="Clients"
                  value={stats?.total_clients || 0}
                  icon={Users}
                  color="blue"
                />
                <StatsCard
                  title="Hospital Staff"
                  value={stats?.total_hospitals || 0}
                  icon={Building2}
                  color="teal"
                />
                <StatsCard
                  title="Total Analyses"
                  value={stats?.total_analyses || 0}
                  icon={Activity}
                  color="pink"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active vs Inactive Users */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">User Status</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Active Users</span>
                      <span className="text-green-400 font-semibold">{stats?.active_users || 0}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${stats ? (stats.active_users / stats.total_users) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Inactive Users</span>
                      <span className="text-red-400 font-semibold">{stats?.inactive_users || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Hospital Entities */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Hospital Entities</h3>
                  <div className="text-4xl font-bold text-teal-400 mb-2">
                    {stats?.total_hospital_entities || 0}
                  </div>
                  <p className="text-slate-400 text-sm">Registered hospital organizations</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Filters & Actions */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">All Roles</option>
                  <option value="client">Clients</option>
                  <option value="hospital">Hospital Staff</option>
                  <option value="admin">Admins</option>
                </select>
                <button
                  onClick={() => setShowCreateUserModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Add User
                </button>
              </div>

              {/* Users Table */}
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-800/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-white font-medium">{user.name || "—"}</div>
                              <div className="text-slate-400 text-sm">{user.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.role === "admin"
                                ? "bg-purple-500/20 text-purple-300"
                                : user.role === "hospital"
                                ? "bg-teal-500/20 text-teal-300"
                                : "bg-blue-500/20 text-blue-300"
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.status === "active"
                                ? "bg-green-500/20 text-green-300"
                                : "bg-red-500/20 text-red-300"
                            }`}>
                              {user.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-sm">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => { setSelectedUser(user); setShowPasswordModal(true); }}
                                className="p-2 text-slate-400 hover:text-yellow-400 transition-colors"
                                title="Change Password"
                              >
                                <Key className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleUserStatus(user)}
                                className={`p-2 transition-colors ${
                                  user.status === "active"
                                    ? "text-slate-400 hover:text-orange-400"
                                    : "text-slate-400 hover:text-green-400"
                                }`}
                                title={user.status === "active" ? "Deactivate" : "Activate"}
                              >
                                {user.status === "active" ? <UserMinus className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* Hospitals Tab */}
          {activeTab === "hospitals" && (
            <motion.div
              key="hospitals"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">Hospital Entities</h2>
                <button
                  onClick={() => setShowCreateHospitalModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Hospital
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {hospitals.map((hospital) => (
                  <div
                    key={hospital.id}
                    className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6 hover:border-teal-500/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-teal-400" />
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        hospital.is_active
                          ? "bg-green-500/20 text-green-300"
                          : "bg-red-500/20 text-red-300"
                      }`}>
                        {hospital.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-1">{hospital.name}</h3>
                    <p className="text-slate-400 text-sm mb-4">Code: {hospital.code}</p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-slate-400">
                        <span className="text-white font-medium">{hospital.staff_count}</span> Staff
                      </div>
                      <div className="text-slate-400">
                        <span className="text-white font-medium">{hospital.client_count}</span> Clients
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700/50">
                      <button
                        onClick={() => handleDeleteHospital(hospital.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Assignments Tab */}
          {activeTab === "assignments" && (
            <motion.div
              key="assignments"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Unassigned Clients Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-400" />
                    Unassigned Clients
                    {unassignedClients.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-sm">
                        {unassignedClients.length}
                      </span>
                    )}
                  </h2>
                </div>
                
                {unassignedClients.length === 0 ? (
                  <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-8 text-center">
                    <Check className="w-10 h-10 text-green-400 mx-auto mb-3" />
                    <p className="text-slate-300">All clients have been assigned to hospitals!</p>
                  </div>
                ) : (
                  <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-orange-500/30 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-800/50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Client</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Client ID</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Organization</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {unassignedClients.map((client) => (
                            <tr key={client.client_profile_id} className="hover:bg-slate-700/30 transition-colors">
                              <td className="px-6 py-4">
                                <div>
                                  <div className="text-white font-medium">{client.name || "—"}</div>
                                  <div className="text-slate-400 text-sm">{client.email}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-300">{client.client_id}</td>
                              <td className="px-6 py-4 text-slate-400">{client.organization || "—"}</td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => { setSelectedClient(client); setShowAssignModal(true); }}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-500/20 text-teal-400 rounded-lg hover:bg-teal-500/30 transition-colors text-sm"
                                >
                                  <Link2 className="w-4 h-4" />
                                  Assign to Hospital
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* All Clients with Assignments */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">All Client Assignments</h2>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search clients..."
                      value={assignmentSearchQuery}
                      onChange={(e) => setAssignmentSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <select
                    value={hospitalFilter}
                    onChange={(e) => setHospitalFilter(e.target.value)}
                    className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">All Hospitals</option>
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>

                {/* Clients Table */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-800/50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Client</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Client ID</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Assigned Hospital(s)</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {allClients.map((client) => (
                          <tr key={client.client_profile_id} className="hover:bg-slate-700/30 transition-colors">
                            <td className="px-6 py-4">
                              <div>
                                <div className="text-white font-medium">{client.name || "—"}</div>
                                <div className="text-slate-400 text-sm">{client.email}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-300 text-sm">{client.client_id}</td>
                            <td className="px-6 py-4">
                              {client.assigned_hospitals.length === 0 ? (
                                <span className="text-orange-400 text-sm">Not assigned</span>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {client.assigned_hospitals.map((h) => (
                                    <div
                                      key={h.assignment_id}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-teal-500/20 text-teal-300 rounded text-xs"
                                    >
                                      <Building2 className="w-3 h-3" />
                                      {h.hospital_name}
                                      <button
                                        onClick={() => handleRemoveAssignment(h.assignment_id)}
                                        className="ml-1 p-0.5 hover:bg-red-500/30 rounded text-slate-400 hover:text-red-400"
                                        title="Remove from hospital"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                client.status === "active"
                                  ? "bg-green-500/20 text-green-300"
                                  : "bg-red-500/20 text-red-300"
                              }`}>
                                {client.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* Add to hospital */}
                                <button
                                  onClick={() => { 
                                    setSelectedClient({
                                      client_profile_id: client.client_profile_id,
                                      user_id: client.user_id,
                                      client_id: client.client_id,
                                      name: client.name,
                                      email: client.email,
                                      organization: client.organization
                                    }); 
                                    setShowAssignModal(true); 
                                  }}
                                  className="p-2 text-slate-400 hover:text-teal-400 transition-colors"
                                  title="Add to hospital"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                                {/* Reassign */}
                                {client.assigned_hospitals.length > 0 && (
                                  <button
                                    onClick={() => {
                                      setSelectedClientForReassign(client);
                                      setSelectedAssignment(client.assigned_hospitals[0]);
                                      setShowReassignModal(true);
                                    }}
                                    className="p-2 text-slate-400 hover:text-yellow-400 transition-colors"
                                    title="Reassign to different hospital"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {allClients.length === 0 && (
                    <div className="p-12 text-center">
                      <Users className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                      <p className="text-slate-400">No clients found</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Analyze X-Ray Tab */}
          {activeTab === "analyze" && (
            <motion.div
              key="analyze"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-purple-400" /> Analyze a Wrist X-Ray
                  </h3>
                  <label className="block border-2 border-dashed border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-purple-500 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={analyzeProcessing}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleAdminAnalyze(f);
                        e.currentTarget.value = "";
                      }}
                    />
                    <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                    <p className="text-slate-300 font-medium">Click to upload an X-ray image</p>
                    <p className="text-slate-500 text-sm mt-1">PNG, JPG (max 25MB)</p>
                  </label>
                  {analyzeProcessing && (
                    <div className="mt-4 flex items-center gap-3 text-purple-300">
                      <RefreshCw className="w-5 h-5 animate-spin" /> Analyzing image...
                    </div>
                  )}
                  {analyzeError && (
                    <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
                      {analyzeError}
                    </div>
                  )}
                </div>

                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Result</h3>
                  {analyzeResult ? (
                    <div className="space-y-4">
                      <img
                        src={`${API_BASE}/xray/download/${analyzeResult.processed_image_url}`}
                        alt="Processed X-Ray"
                        className="w-full rounded-xl border border-slate-700"
                      />
                      <div className="space-y-2">
                        {(analyzeResult.detections || []).filter((d: any) => d.class_name !== "text").length === 0 ? (
                          <p className="text-green-400">No abnormalities detected.</p>
                        ) : (
                          (analyzeResult.detections || [])
                            .filter((d: any) => d.class_name !== "text")
                            .map((d: any, i: number) => (
                              <div key={i} className="flex justify-between text-sm bg-slate-900/50 px-3 py-2 rounded-lg">
                                <span className="capitalize text-white">{d.class_name}</span>
                                <span className="text-purple-300">{(d.confidence * 100).toFixed(1)}%</span>
                              </div>
                            ))
                        )}
                      </div>
                      <a
                        href={`${API_BASE}/xray/download/${analyzeResult.report_url || analyzeResult.processed_image_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors"
                      >
                        <Download className="w-4 h-4" /> Download Report
                      </a>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">Upload an X-ray to see results here.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* All Analyses Tab */}
          {activeTab === "analyses" && (
            <motion.div
              key="analyses"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-400" /> All Analyses ({analyses.length})
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    <select
                      value={analysisHospitalFilter}
                      onChange={(e) => setAnalysisHospitalFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                    >
                      <option value="">All Hospitals</option>
                      {hospitals.map((h) => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                    <select
                      value={analysisUserFilter}
                      onChange={(e) => setAnalysisUserFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                    >
                      <option value="">All Patients / Users</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {analyses.length === 0 ? (
                  <div className="p-12 text-center">
                    <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                    <p className="text-slate-400">No analyses found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analyses.map((a) => {
                      const dets = parseDetections(a.detections).filter((d) => d.class_name !== "text");
                      return (
                        <div key={a.id} className="bg-slate-900/40 rounded-xl border border-slate-700/40 p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{a.user_name || a.user_email || "Unknown"}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                              <span>Hospital: {a.hospital_name || "—"}</span>
                              <span className="truncate max-w-[14rem]">File: {a.original_filename}</span>
                              <span>{formatDateTime(a.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {dets.length === 0 ? (
                              <span className="text-green-400 text-xs">No findings</span>
                            ) : (
                              dets.map((d, i) => (
                                <span key={i} className="text-xs px-2 py-1 bg-amber-500/20 text-amber-300 rounded-full capitalize">
                                  {d.class_name} {(d.confidence * 100).toFixed(0)}%
                                </span>
                              ))
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {a.processed_filename && (
                              <a
                                href={`${API_BASE}/xray/download/${a.processed_filename}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 bg-slate-700/50 rounded-lg text-slate-300 hover:text-white transition-colors"
                                title="View processed image"
                              >
                                <Eye className="w-4 h-4" />
                              </a>
                            )}
                            {a.report_filename && (
                              <a
                                href={`${API_BASE}/xray/download/${a.report_filename}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 bg-purple-500/20 rounded-lg text-purple-300 hover:bg-purple-500/30 transition-colors"
                                title="Download report"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Contact Messages Tab */}
          {activeTab === "messages" && (
            <motion.div
              key="messages"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-400" /> Contact Messages ({messages.length})
                </h3>
                {messages.length === 0 ? (
                  <div className="p-12 text-center">
                    <Mail className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                    <p className="text-slate-400">No messages yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((m) => (
                      <div key={m.id} className="bg-slate-900/40 rounded-xl border border-slate-700/40 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div>
                            <span className="text-white font-medium">{m.name}</span>
                            <a href={`mailto:${m.email}`} className="text-purple-300 text-sm ml-2">{m.email}</a>
                          </div>
                          <span className="text-slate-500 text-xs">{formatDateTime(m.created_at)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2 text-xs">
                          {m.organization && (
                            <span className="px-2 py-1 bg-slate-700/50 rounded-full text-slate-300">{m.organization}</span>
                          )}
                          {m.reason && (
                            <span className="px-2 py-1 bg-teal-500/20 rounded-full text-teal-300 capitalize">{m.reason}</span>
                          )}
                        </div>
                        <p className="text-slate-300 text-sm whitespace-pre-wrap">{m.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        onSuccess={loadDashboardData}
        hospitals={hospitals}
        fetchWithAuth={fetchWithAuth}
      />

      {/* Create Hospital Modal */}
      <CreateHospitalModal
        isOpen={showCreateHospitalModal}
        onClose={() => setShowCreateHospitalModal(false)}
        onSuccess={loadDashboardData}
        fetchWithAuth={fetchWithAuth}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => { setShowPasswordModal(false); setSelectedUser(null); }}
        user={selectedUser}
        fetchWithAuth={fetchWithAuth}
      />

      {/* Assign Client Modal */}
      <AssignClientModal
        isOpen={showAssignModal}
        onClose={() => { setShowAssignModal(false); setSelectedClient(null); }}
        client={selectedClient}
        hospitals={hospitals}
        onAssign={handleAssignClient}
      />

      {/* Reassign Client Modal */}
      <ReassignClientModal
        isOpen={showReassignModal}
        onClose={() => { setShowReassignModal(false); setSelectedClientForReassign(null); setSelectedAssignment(null); }}
        client={selectedClientForReassign}
        currentAssignment={selectedAssignment}
        hospitals={hospitals}
        onReassign={handleReassignClient}
      />
    </div>
  );
};

// Stats Card Component
interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: "purple" | "blue" | "teal" | "pink";
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, color }) => {
  const colorClasses = {
    purple: "from-purple-500 to-purple-600",
    blue: "from-blue-500 to-blue-600",
    teal: "from-teal-500 to-teal-600",
    pink: "from-pink-500 to-pink-600",
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-slate-400 text-sm">{title}</div>
    </div>
  );
};

// Create User Modal
interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  hospitals: Hospital[];
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onSuccess, hospitals, fetchWithAuth }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    role: "client",
    client_id: "",
    organization: "",
    hospital_entity_id: "",
    staff_id: "",
    department: "",
    position: "",
    admin_id: "",
    access_level: "full",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload: any = {
        email: formData.email,
        password: formData.password,
        name: formData.name,
        role: formData.role,
      };

      if (formData.role === "client") {
        payload.client_id = formData.client_id || undefined;
        payload.organization = formData.organization || undefined;
      } else if (formData.role === "hospital") {
        payload.hospital_entity_id = parseInt(formData.hospital_entity_id) || undefined;
        payload.staff_id = formData.staff_id || undefined;
        payload.department = formData.department || undefined;
        payload.position = formData.position || undefined;
      } else if (formData.role === "admin") {
        payload.admin_id = formData.admin_id || undefined;
        payload.access_level = formData.access_level;
      }

      const res = await fetchWithAuth(`${API_BASE}/admin/users`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSuccess();
        onClose();
        setFormData({
          email: "", password: "", name: "", role: "client",
          client_id: "", organization: "", hospital_entity_id: "",
          staff_id: "", department: "", position: "", admin_id: "", access_level: "full",
        });
      } else {
        const data = await res.json().catch(() => ({}));
        setError(extractErrorMessage(data, "Failed to create user"));
      }
    } catch (err) {
      setError("Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Create User</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              <option value="client">Client</option>
              <option value="hospital">Hospital Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Role-specific fields */}
          {formData.role === "client" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Client ID (optional)</label>
                <input
                  type="text"
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Organization (optional)</label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </>
          )}

          {formData.role === "hospital" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Hospital</label>
                <select
                  required
                  value={formData.hospital_entity_id}
                  onChange={(e) => setFormData({ ...formData, hospital_entity_id: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">Select Hospital</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Staff ID (optional)</label>
                <input
                  type="text"
                  value={formData.staff_id}
                  onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Department (optional)</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Position (optional)</label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </>
          )}

          {formData.role === "admin" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Admin ID (optional)</label>
                <input
                  type="text"
                  value={formData.admin_id}
                  onChange={(e) => setFormData({ ...formData, admin_id: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Access Level</label>
                <select
                  value={formData.access_level}
                  onChange={(e) => setFormData({ ...formData, access_level: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="full">Full Access</option>
                  <option value="limited">Limited Access</option>
                </select>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create User"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

// Create Hospital Modal
interface CreateHospitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const CreateHospitalModal: React.FC<CreateHospitalModalProps> = ({ isOpen, onClose, onSuccess, fetchWithAuth }) => {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Only send optional fields when they actually have a value. An empty
      // string for `email` fails the backend's EmailStr validation (422), so
      // omit blanks entirely and let the backend default them to null.
      const payload: Record<string, string> = {
        name: formData.name.trim(),
        code: formData.code.trim(),
      };
      if (formData.email.trim()) payload.email = formData.email.trim();
      if (formData.phone.trim()) payload.phone = formData.phone.trim();
      if (formData.address.trim()) payload.address = formData.address.trim();

      const res = await fetchWithAuth(`${API_BASE}/admin/hospitals`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSuccess();
        onClose();
        setFormData({ name: "", code: "", address: "", phone: "", email: "" });
      } else {
        const data = await res.json().catch(() => ({}));
        setError(extractErrorMessage(data, "Failed to create hospital"));
      }
    } catch (err) {
      setError("Failed to create hospital");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Create Hospital</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Hospital Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Hospital Code</label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
              placeholder="e.g., HSP-001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email (optional)</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Phone (optional)</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Address (optional)</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
              rows={3}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Hospital"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

// Change Password Modal
interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, user, fetchWithAuth }) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      const res = await fetchWithAuth(`${API_BASE}/admin/users/${user?.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ new_password: newPassword }),
      });

      if (res.ok) {
        onClose();
        setNewPassword("");
        setConfirmPassword("");
        alert("Password changed successfully");
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to change password");
      }
    } catch (err) {
      setError("Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Change Password</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-400 mb-4">Changing password for: <span className="text-white">{user.email}</span></p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
          >
            {loading ? "Changing..." : "Change Password"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

// Assign Client Modal
interface AssignClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: UnassignedClient | null;
  hospitals: Hospital[];
  onAssign: (clientId: number, hospitalId: number) => void;
}

const AssignClientModal: React.FC<AssignClientModalProps> = ({ isOpen, onClose, client, hospitals, onAssign }) => {
  const [selectedHospital, setSelectedHospital] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (client && selectedHospital) {
      onAssign(client.client_profile_id, parseInt(selectedHospital));
    }
  };

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Assign Client to Hospital</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-4 bg-slate-700/50 rounded-lg">
          <p className="text-white font-medium">{client.name || client.email}</p>
          <p className="text-slate-400 text-sm">Client ID: {client.client_id}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Select Hospital</label>
            <select
              required
              value={selectedHospital}
              onChange={(e) => setSelectedHospital(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
            >
              <option value="">Choose a hospital...</option>
              {hospitals.filter(h => h.is_active).map((h) => (
                <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={!selectedHospital}
            className="w-full py-3 bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50"
          >
            Assign Client
          </button>
        </form>
      </motion.div>
    </div>
  );
};

// Reassign Client Modal
interface ReassignClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientWithAssignments | null;
  currentAssignment: AssignedHospital | null;
  hospitals: Hospital[];
  onReassign: (assignmentId: number, newHospitalId: number) => void;
}

const ReassignClientModal: React.FC<ReassignClientModalProps> = ({ 
  isOpen, onClose, client, currentAssignment, hospitals, onReassign 
}) => {
  const [selectedHospital, setSelectedHospital] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSelectedHospital("");
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentAssignment && selectedHospital) {
      onReassign(currentAssignment.assignment_id, parseInt(selectedHospital));
    }
  };

  if (!isOpen || !client || !currentAssignment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Reassign Client</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-4 bg-slate-700/50 rounded-lg">
          <p className="text-white font-medium">{client.name || client.email}</p>
          <p className="text-slate-400 text-sm">Client ID: {client.client_id}</p>
        </div>

        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-300 text-sm">
            <strong>Current Hospital:</strong> {currentAssignment.hospital_name}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">New Hospital</label>
            <select
              required
              value={selectedHospital}
              onChange={(e) => setSelectedHospital(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-yellow-500"
            >
              <option value="">Choose a new hospital...</option>
              {hospitals
                .filter(h => h.is_active && h.id !== currentAssignment.hospital_id)
                .map((h) => (
                  <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
                ))
              }
            </select>
          </div>

          <button
            type="submit"
            disabled={!selectedHospital}
            className="w-full py-3 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
          >
            Reassign Client
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;

