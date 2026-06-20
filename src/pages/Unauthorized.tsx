import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Unauthorized() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full text-center"
      >
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <ShieldOff className="h-9 w-9 text-red-400" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-white mb-3">Access Denied</h1>
        <p className="text-gray-400 mb-2">
          You do not have permission to access the{' '}
          <span className="text-white font-medium">Operator Command Center</span>.
        </p>
        <p className="text-sm text-gray-500 mb-8">
          This area is restricted to users with the <span className="font-mono text-red-400">admin</span> role.
          If you believe this is an error, contact your system administrator.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="default">
            <Link to="/dashboard">Return to Dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Go Home</Link>
          </Button>
        </div>

        {/* Footer note */}
        <p className="text-xs text-gray-600 mt-8">
          D3VONN.IO · Operator Command Center · Admin Access Required
        </p>
      </motion.div>
    </div>
  );
}
