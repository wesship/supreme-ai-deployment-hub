import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';

export function ChatLauncher({ onClick, loading = false }: { onClick: () => void; loading?: boolean }) {
  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20"
      style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 100%)',
        border: '1px solid rgba(59, 255, 122, 0.4)',
        boxShadow: '0 0 20px rgba(59, 255, 122, 0.15), 0 4px 20px rgba(0,0,0,0.5)',
      }}
      aria-label="Open Devonn AI Chat"
      aria-busy={loading}
      disabled={loading}
    >
      <MessageSquare className="w-6 h-6 text-green-400" />
      {/* Pulse ring */}
      <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-green-400" />
    </motion.button>
  );
}
