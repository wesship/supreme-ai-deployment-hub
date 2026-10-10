
import React from 'react';
import { motion } from 'framer-motion';
import { saveAs } from 'file-saver';
import { Download, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import CodeDisplay from '@/components/CodeDisplay';

interface ManifestCodeProps {
  code: string;
  title: string;
  downloadFileName: string;
}

const ManifestCode: React.FC<ManifestCodeProps> = ({ code, title, downloadFileName }) => {
  // Function to download the manifest
  const downloadManifest = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, downloadFileName);
    toast.success(`${title} downloaded successfully`);
  };
  
  // Function to copy the manifest to clipboard
  const copyManifest = () => {
    navigator.clipboard.writeText(code)
      .then(() => toast.success(`${title} copied to clipboard`))
      .catch(err => toast.error('Failed to copy: ' + err));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="mt-8"
    >
      {title && <h3 className="text-xl font-semibold mb-4 text-center">{title}</h3>}
      
      <CodeDisplay 
        code={code}
        language="yaml"
        title={downloadFileName}
        showLineNumbers={true}
        className="shadow-xl"
      />
      
      <div className="mt-6 flex justify-center space-x-4">
        <Button
          onClick={downloadManifest}
          className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Download className="mr-2 h-4 w-4" />
          Download {title}
        </Button>
        
        <Button
          onClick={copyManifest}
          variant="outline"
          className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy to Clipboard
        </Button>
      </div>
    </motion.div>
  );
};

export default ManifestCode;
