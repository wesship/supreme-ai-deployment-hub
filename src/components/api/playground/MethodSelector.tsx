
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MethodSelectorProps {
  method: string;
  onMethodChange: (method: string) => void;
}

const MethodSelector: React.FC<MethodSelectorProps> = ({ method, onMethodChange }) => {
  const getMethodClass = (selectedMethod: string) => {
    switch (selectedMethod) {
      case 'GET': return 'method-get';
      case 'POST': return 'method-post';
      case 'PUT': return 'method-put';
      case 'DELETE': return 'method-delete';
      case 'PATCH': return 'method-patch';
      default: return '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <label className="text-sm font-medium mb-2 block">HTTP Method</label>
      <Select value={method} onValueChange={onMethodChange}>
        <SelectTrigger className={cn("font-medium", getMethodClass(method))}>
          <SelectValue placeholder="HTTP Method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="GET" className="method-get">GET</SelectItem>
          <SelectItem value="POST" className="method-post">POST</SelectItem>
          <SelectItem value="PUT" className="method-put">PUT</SelectItem>
          <SelectItem value="DELETE" className="method-delete">DELETE</SelectItem>
          <SelectItem value="PATCH" className="method-patch">PATCH</SelectItem>
        </SelectContent>
      </Select>
    </motion.div>
  );
};

export default MethodSelector;
