
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Upload, FileText } from 'lucide-react';
import { backendService } from '@/services/backendService';

const SkillParser = () => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      // Read file content
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setText(event.target.result as string);
        }
      };
      reader.readAsText(e.target.files[0]);
    }
  };
  
  const handleExtractSkills = async () => {
    if (!text) {
      toast.error('Please provide text or upload a file');
      return;
    }
    
    setIsParsing(true);
    try {
      const result = await backendService.extractSkills(text);
      setSkills(result.skills || []);
      toast.success('Skills extracted successfully');
    } catch (error) {
      console.error('Error extracting skills:', error);
      toast.error('Failed to extract skills');
    } finally {
      setIsParsing(false);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Skill Extractor</CardTitle>
        <CardDescription>
          Upload a resume or paste text to extract skills
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <label 
            htmlFor="resume" 
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 mb-2 text-gray-500" />
              <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                TXT, PDF, DOCX or MD files
              </p>
            </div>
            <Input
              id="resume"
              type="file"
              className="hidden"
              accept=".txt,.pdf,.docx,.md"
              onChange={handleFileChange}
            />
          </label>
          {file && (
            <div className="flex items-center gap-2 mt-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="text-sm">{file.name}</span>
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Or paste resume text here..."
            rows={5}
          />
        </div>
        
        <Button 
          onClick={handleExtractSkills}
          disabled={isParsing || !text}
          className="w-full"
        >
          {isParsing ? 'Extracting...' : 'Extract Skills'}
        </Button>
        
        {skills.length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-medium mb-2">Extracted Skills</h3>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SkillParser;
