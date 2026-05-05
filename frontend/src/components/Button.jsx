import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const Button = ({ text, isLoading, onClick, disabled }) => {
  return (
    <motion.button
      whileHover={disabled || isLoading ? {} : { scale: 1.02, boxShadow: "0px 5px 15px rgba(0,0,0,0.2)" }}
      whileTap={disabled || isLoading ? {} : { scale: 0.98 }}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`w-full h-[45px] mt-6 rounded-lg font-semibold text-white flex items-center justify-center transition-colors
        ${disabled || isLoading ? 'bg-white/20 cursor-not-allowed text-white/50' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg'}`}
    >
      {isLoading ? (
        <>
          <Loader2 size={18} className="animate-spin mr-2" />
          Logging in...
        </>
      ) : (
        text
      )}
    </motion.button>
  );
};

export default Button;