import { motion, AnimatePresence } from 'framer-motion';

const InputField = ({ id, label, type, icon: Icon, rightIcon: RightIcon, onRightIconClick, error, value, ...props }) => {
  return (
    <div className="w-full mb-5">
      <div className={`relative flex items-center bg-white/[0.03] rounded-2xl border backdrop-blur-xl transition-all duration-500
        ${error ? 'border-red-500/30 bg-red-500/[0.02]' : 'border-white/10 focus-within:bg-white/[0.08] focus-within:border-white/30 hover:bg-white/[0.06]'}`}
      >
        <input
          id={id}
          type={type}
          value={value}
          className={`peer w-full bg-transparent text-white/90 pt-7 pb-3 ${Icon ? 'pl-12' : 'pl-5'} ${RightIcon ? 'pr-12' : 'pr-5'} focus:outline-none text-[15px] placeholder-transparent`}
          placeholder={label}
          {...props}
        />

        {Icon && (
          <div className="absolute left-5 text-white/30 pointer-events-none transition-colors duration-500 peer-focus:text-white/80">
            <Icon size={18} strokeWidth={2} />
          </div>
        )}

        <label
          htmlFor={id}
          className={`absolute text-white/40 text-[15px] transition-all duration-500 pointer-events-none origin-left
            ${Icon ? 'left-12' : 'left-5'} top-4
            peer-focus:-translate-y-2.5 peer-focus:scale-[0.82] peer-focus:text-white/70
            peer-[:not(:placeholder-shown)]:-translate-y-2.5 peer-[:not(:placeholder-shown)]:scale-[0.82] peer-[:not(:placeholder-shown)]:text-white/70`}
        >
          {label}
        </label>

        {RightIcon && (
          <button
            type="button"
            onClick={onRightIconClick}
            className="absolute right-5 text-white/30 hover:text-white/90 focus:outline-none transition-colors duration-300"
          >
            <RightIcon size={18} strokeWidth={2} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="text-red-300/90 text-[13px] font-medium tracking-wide ml-2"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InputField;