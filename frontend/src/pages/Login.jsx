import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import InputField from '../components/InputField';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  const from = location.state?.from?.pathname || '/dashboard';

  const validateForm = () => {
    const newErrors = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Please enter a valid university email";
    if (!password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (error) {
      setServerError(error.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#041210] flex overflow-hidden font-sans">
      
      {/* ========================================= */}
      {/* LAYER 1: SOFT MESH GRADIENT ORBS          */}
      {/* ========================================= */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{ x: [0, 50, -20, 0], y: [0, -30, 40, 0], scale: [1, 1.1, 0.9, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-emerald-700/20 rounded-full blur-[120px] mix-blend-screen"
        />
        <motion.div 
          animate={{ x: [0, -40, 30, 0], y: [0, 50, -20, 0], scale: [1, 0.9, 1.1, 1] }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-teal-600/15 rounded-full blur-[140px] mix-blend-screen"
        />
        <motion.div 
          animate={{ opacity: [0.1, 0.25, 0.1], scale: [1, 1.2, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] bg-[#0B4C3A]/20 rounded-full blur-[100px] mix-blend-screen"
        />
      </div>

      {/* ========================================= */}
      {/* CORNER ANCHORS (ENTERPRISE CREDIBILITY)   */}
      {/* ========================================= */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="absolute top-6 right-6 lg:top-10 lg:right-10 z-20 flex items-center gap-3 px-4 py-2 bg-white/[0.02] border border-white/[0.05] rounded-full backdrop-blur-md"
      >
        <div className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </div>
        <span className="text-white/50 text-[11px] font-medium tracking-widest uppercase">All Systems Normal</span>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 lg:left-12 lg:translate-x-0 z-20 flex items-center gap-6 text-[11px] font-medium text-white/30 tracking-wide"
      >
        <a href="#" className="hover:text-emerald-400/80 transition-colors">Privacy</a>
        <span className="w-1 h-1 rounded-full bg-white/10"></span>
        <a href="#" className="hover:text-emerald-400/80 transition-colors">Terms</a>
        <span className="w-1 h-1 rounded-full bg-white/10"></span>
        <a href="#" className="hover:text-emerald-400/80 transition-colors">IT Support</a>
      </motion.div>

      {/* ========================================= */}
      {/* MAIN LAYOUT: TWO-COLUMN SPLIT             */}
      {/* ========================================= */}
      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between px-6 py-20 lg:px-12 gap-16 lg:gap-8 min-h-screen">
        
        {/* LEFT COLUMN: BRANDING & TYPOGRAPHY */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left pt-10 lg:pt-0"
        >
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-8 backdrop-blur-md">
            <ShieldCheck size={18} className="text-emerald-400" />
            <span className="text-emerald-300/90 text-sm font-medium tracking-wide">Enterprise Secure Portal</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1]">
            University of <br className="hidden lg:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200 drop-shadow-[0_0_15px_rgba(52,211,153,0.2)]">
              Roehampton
            </span>
          </h1>
          
          <p className="text-xl lg:text-2xl font-normal text-white/50 mt-6 max-w-lg leading-relaxed">
            Intelligent Student Dashboard <br className="hidden lg:block" />& ChatBot System
          </p>
        </motion.div>

        {/* RIGHT COLUMN: LOGIN CARD */}
        <div className="w-full lg:w-1/2 flex justify-center lg:justify-end">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={`w-full max-w-[440px] ${serverError ? 'animate-shake' : ''}`}
          >
            <div className="bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] p-10 rounded-[2rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] relative overflow-hidden">
              
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

              <div className="mb-10">
                <div className="inline-flex items-center px-5 py-2.5 bg-white/[0.05] border border-white/10 rounded-2xl mb-6 shadow-sm backdrop-blur-md">
                  <span className="text-white font-extrabold text-2xl tracking-tighter drop-shadow-md">My</span>
                  <span className="text-emerald-300 font-medium text-2xl tracking-tight drop-shadow-md">Uni</span>
                </div>
                <h2 className="text-3xl font-semibold text-white/90 tracking-tight mb-2">Welcome back</h2>
                <p className="text-white/40 text-sm">Sign in to your account</p>
              </div>

              <AnimatePresence>
                {serverError && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, height: 'auto', scale: 1 }} 
                    exit={{ opacity: 0, height: 0, scale: 0.95 }}
                    className="mb-6 overflow-hidden"
                  >
                    <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-2xl text-sm flex items-center backdrop-blur-md">
                      <AlertCircle size={18} className="mr-2 flex-shrink-0 opacity-80" />
                      {serverError}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleLogin}>
                <InputField 
                  id="email"
                  label="University Email"
                  type="text"
                  icon={Mail}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: null });
                  }}
                  error={errors.email}
                />

                <InputField 
                  id="password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  icon={Lock}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: null });
                  }}
                  error={errors.password}
                  rightIcon={showPassword ? EyeOff : Eye}
                  onRightIconClick={() => setShowPassword(!showPassword)}
                />

                <div className="flex items-center justify-between mt-2 mb-8 text-sm px-1">
                  <label className="flex items-center text-white/40 cursor-pointer hover:text-white/80 transition-colors duration-300 group">
                    <div className="relative flex items-center justify-center w-4 h-4 mr-3 border border-white/20 rounded-md bg-white/[0.02] group-hover:border-white/40 transition-all duration-300">
                      <input type="checkbox" className="absolute opacity-0 w-full h-full cursor-pointer peer" />
                      <motion.div 
                        initial={false}
                        className="hidden peer-checked:block w-2 h-2 bg-emerald-400 rounded-sm shadow-[0_0_8px_rgba(52,211,153,0.8)]" 
                      />
                    </div>
                    Remember me
                  </label>
                  <a href="#" className="text-emerald-400/80 hover:text-emerald-300 transition-colors duration-300 font-medium">Forgot password?</a>
                </div>

                <motion.button 
                  whileHover={loading ? {} : { scale: 1.01, backgroundColor: 'rgba(255,255,255,0.15)' }}
                  whileTap={loading ? {} : { scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className={`w-full h-[56px] rounded-2xl font-medium text-white flex items-center justify-center transition-all duration-500 backdrop-blur-md border border-white/10
                    ${loading 
                      ? 'bg-white/5 cursor-not-allowed text-white/50' 
                      : 'bg-white/10 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:border-white/30'
                    }`}
                >
                  {loading ? <Loader2 size={20} className="animate-spin text-white/50" /> : 'Sign In'}
                </motion.button>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;