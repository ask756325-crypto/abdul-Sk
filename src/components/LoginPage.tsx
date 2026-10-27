import React, { useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { UserProfile, UserRole } from '../db/types';

interface LoginPageProps {
  users: UserProfile[];
  onLogin: (user: UserProfile) => void;
}

export function LoginPage({ users, onLogin }: LoginPageProps) {
  const [authMode, setAuthMode] = useState<'CREDENTIALS' | 'FAST_TRACK'>('FAST_TRACK');
  const [selectedUserEmail, setSelectedUserEmail] = useState('cmo@aicte-india.org');
  const [password, setPassword] = useState('AICTE@2026#Gov');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);

  // Captcha State
  const [captchaCode, setCaptchaCode] = useState(() => generateCaptcha());
  const [captchaInput, setCaptchaInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  function generateCaptcha() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  const handleRefreshCaptcha = () => {
    setCaptchaCode(generateCaptcha());
    setCaptchaInput('');
    setErrorMessage(null);
  };

  const handleCredentialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate Captcha
    if (captchaInput.trim().toUpperCase() !== captchaCode.toUpperCase()) {
      setErrorMessage('Security verification code (Captcha) does not match. Please try again.');
      setCaptchaCode(generateCaptcha());
      setCaptchaInput('');
      return;
    }

    // Find User
    const matched = users.find(
      (u) =>
        u.email.toLowerCase() === selectedUserEmail.trim().toLowerCase() ||
        u.id.toLowerCase() === selectedUserEmail.trim().toLowerCase()
    );

    if (!matched) {
      setErrorMessage(
        'Invalid official email or employee identifier. For evaluation, use one of the configured officer profiles.'
      );
      return;
    }

    if (!matched.active) {
      setErrorMessage('This user account is suspended or inactive. Please contact the Super Administrator.');
      return;
    }

    onLogin(matched);
  };

  const handleFastTrackLogin = (user: UserProfile) => {
    setErrorMessage(null);
    onLogin(user);
  };

  // Preset role metadata for judges
  const roleBadges: Record<UserRole, { color: string; badge: string; desc: string }> = {
    SUPER_ADMIN: {
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      badge: 'Full Platform Admin',
      desc: 'System governance, SLA rules, bureau directory, institution CSV batch imports & user administration.',
    },
    CENTRAL_MONITORING_OFFICER: {
      color: 'bg-teal-100 text-teal-800 border-teal-200',
      badge: 'Central Command',
      desc: 'Consolidated cross-bureau dashboard, complaint routing, inter-bureau transfers, SLA scan & AI assistant.',
    },
    BUREAU_OFFICER: {
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      badge: 'Bureau Officer',
      desc: 'Investigate assigned complaints, issue clarification requests to institutions, propose formal resolutions.',
    },
    INSTITUTION_LIAISON: {
      color: 'bg-amber-100 text-amber-800 border-amber-200',
      badge: 'Institution Liaison',
      desc: 'Strictly scoped to institution complaints; internal notes hidden; submits formal compliance responses.',
    },
    AUDITOR: {
      color: 'bg-slate-100 text-slate-800 border-slate-300',
      badge: 'Read-Only Auditor',
      desc: 'Independent compliance audit, full inspection of tamper-evident audit logs and CSV export (no write permissions).',
    },
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between selection:bg-teal-700 selection:text-white">
      {/* Top Government Tricolor Stripe */}
      <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-white to-emerald-600" />

      {/* Main Authentication Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl w-full bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
          {/* Official Portal Header */}
          <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 text-white p-6 sm:p-8 border-b border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-teal-900/80 border border-teal-700/60 text-teal-200 text-[11px] font-mono font-medium tracking-wide">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>AICTE CENTRAL GRIEVANCE SYSTEM · SECURE ENTERPRISE ACCESS</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2 pt-1">
                  AICTE Complaint Intelligence Hub
                </h1>
                <p className="text-xs text-slate-300">
                  Integrated Platform for Monitoring & Tracking Institution-Related Complaints Across AICTE Bureaus and Cells
                </p>
              </div>

              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-200">Ministry of Education</div>
                <div className="text-[11px] text-slate-400">Government of India</div>
                <div className="text-[10px] font-mono text-teal-400 mt-1">RBAC Enforced Server-Side</div>
              </div>
            </div>
          </header>

          {/* Mode Switcher Tabs */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 pt-3 flex gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setAuthMode('FAST_TRACK');
                setErrorMessage(null);
              }}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
                authMode === 'FAST_TRACK'
                  ? 'bg-white border-teal-700 text-teal-950 shadow-sm'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-teal-700" />
              <span>Authorized Role Fast-Track (1-Click)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('CREDENTIALS');
                setErrorMessage(null);
              }}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
                authMode === 'CREDENTIALS'
                  ? 'bg-white border-teal-700 text-teal-950 shadow-sm'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-4 h-4 text-teal-700" />
              <span>Official Credential Sign In</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mx-6 mt-4 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-900 text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-red-600 hover:text-red-900 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Body Section */}
          <div className="p-6 sm:p-8">
            {authMode === 'FAST_TRACK' ? (
              /* ================= FAST TRACK ROLES VIEW ================= */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-teal-700" />
                      Select an Authorized Role Session
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Click any role below to enter the platform under its authentic permission scope:
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded hidden sm:inline-block">
                    5 Distinct RBAC Personas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                  {users.map((user) => {
                    const badgeInfo = roleBadges[user.role] || {
                      color: 'bg-slate-100 text-slate-800 border-slate-300',
                      badge: user.role,
                      desc: user.designation,
                    };

                    return (
                      <div
                        key={user.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-600 hover:shadow-md transition-all flex flex-col justify-between gap-3 text-left group"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badgeInfo.color}`}
                            >
                              {badgeInfo.badge}
                            </span>
                            <span className="text-[10px] font-mono text-slate-600">
                              {user.bureauId || user.institutionId || 'Central AICTE'}
                            </span>
                          </div>

                          <div className="font-bold text-slate-900 text-sm group-hover:text-teal-900 transition-colors">
                            {user.fullName}
                          </div>

                          <div className="text-xs text-slate-600 font-medium">
                            {user.designation}
                          </div>

                          <p className="text-[11px] text-slate-500 leading-relaxed pt-1 border-t border-slate-100">
                            {badgeInfo.desc}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleFastTrackLogin(user)}
                          className="w-full mt-1 py-2 px-3 bg-slate-900 group-hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Lock className="w-3.5 h-3.5 text-teal-300" />
                          <span>Sign In as {user.role.replace(/_/g, ' ')} →</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ================= CREDENTIALS FORM VIEW ================= */
              <form onSubmit={handleCredentialSubmit} className="space-y-5 max-w-lg mx-auto">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Administrative Personnel Authentication
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Enter your government email and security credentials to access the institutional complaint database.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Officer Email Select / Input */}
                  <div>
                    <label
                      htmlFor="user-email-input"
                      className="block text-xs font-semibold text-slate-800 mb-1"
                    >
                      Official Email / Employee ID:
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <select
                        id="user-email-input"
                        value={selectedUserEmail}
                        onChange={(e) => setSelectedUserEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                      >
                        {users.map((u) => (
                          <option key={u.id} value={u.email}>
                            {u.email} ({u.fullName} — {u.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Password Input with Show/Hide */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="user-password-input"
                        className="block text-xs font-semibold text-slate-800"
                      >
                        Password / Passphrase:
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-[11px] text-teal-800 hover:underline font-semibold"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        id="user-password-input"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-9 pr-10 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-800"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Captcha Verification */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <label
                      htmlFor="user-captcha-input"
                      className="block text-xs font-semibold text-slate-800"
                    >
                      Security Verification (Captcha):
                    </label>
                    <div className="flex items-center gap-3">
                      <div
                        className="px-4 py-2 bg-slate-900 text-teal-300 font-mono text-base font-bold tracking-widest rounded border border-slate-800 select-none line-through decoration-teal-600/50"
                        title="Security Captcha Code"
                      >
                        {captchaCode}
                      </div>
                      <button
                        type="button"
                        onClick={handleRefreshCaptcha}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-md transition-colors"
                        title="Generate New Captcha"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <input
                        id="user-captcha-input"
                        type="text"
                        placeholder="Enter 5 characters"
                        value={captchaInput}
                        onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
                        maxLength={5}
                        required
                        className="flex-1 px-3 py-2 text-xs font-mono font-bold uppercase bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700"
                      />
                    </div>
                  </div>

                  {/* Remember Session & Security Advisory */}
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberSession}
                        onChange={(e) => setRememberSession(e.target.checked)}
                        className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                      />
                      <span>Keep terminal session active</span>
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">256-bit TLS Protected</span>
                  </div>

                  {/* Sign In Button */}
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-md hover:shadow transition-all flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4 text-teal-200" />
                    <span>Authenticate & Access Dashboard →</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Statutory Security Footer */}
          <footer className="bg-slate-50 border-t border-slate-200 p-4 text-center text-xs text-slate-500 space-y-1">
            <div className="flex items-center justify-center gap-2 text-slate-600 font-medium">
              <Shield className="w-3.5 h-3.5 text-teal-700" />
              <span>Restricted Access · All Activities Recorded in Append-Only Audit Log</span>
            </div>
            <p className="text-[11px] text-slate-600">
              AICTE Central Institutional Grievance Redressal Register · Ministry of Education, Government of India
            </p>
          </footer>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <HelpCircle className="w-4 h-4 text-teal-700" />
                <span>Officer Credential Recovery</span>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p>
                In production government deployments, password resets require NIC / AICTE domain email verification or digital token re-issuance.
              </p>
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 space-y-1">
                <div className="font-semibold text-teal-950">Quick Role Access Guide:</div>
                <div>
                  You can use the <strong>Authorized Role Fast-Track</strong> tab to sign in with any of the 5 official personas with a single click.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowForgotModal(false);
                setAuthMode('FAST_TRACK');
              }}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
            >
              Switch to Fast-Track Roles
            </button>
          </div>
        </div>
      )}

      {/* Global Bottom Disclaimer */}
      <div className="p-3 text-center text-slate-400 text-[11px] font-mono">
        AICTE COMPLAINT INTELLIGENCE HUB · SECURE AUDIT & COMPLAINT RESOLUTION SYSTEM
      </div>
    </div>
  );
}
