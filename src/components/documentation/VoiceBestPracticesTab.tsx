
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, Zap, Users, Settings, ExternalLink, MessageSquare, PhoneCall, Calendar } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import VoicePromptTemplates from './VoicePromptTemplates';

const VoiceBestPracticesTab: React.FC = () => {
  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <Badge variant="outline" className="mb-4">Voice-First Design</Badge>
        <h2 className="text-3xl font-bold mb-2">Voice System Best Practices</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Building a voice-first system requires a fundamentally different approach from traditional web design. 
          This guide provides a strategic roadmap for professional, scalable voice AI deployments.
        </p>
      </div>

      {/* Section 1: Voice-First Prompt Optimization */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">1. Optimize Voice-First Prompts</CardTitle>
              <CardDescription>
                Standard chatbot prompts fail in voice because they are too "wordy"
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="secondary">Rule 1</Badge>
                  The "Wait Your Turn" Rule
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-2">Explicitly instruct the AI:</p>
                <code className="block p-2 bg-background rounded text-xs">
                  "Never give more than two sentences at once. If you need more info, ask 'Should I continue?'"
                </code>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="secondary">Rule 2</Badge>
                  Phonetic Spellings
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-2">Help AI pronounce brand names correctly:</p>
                <code className="block p-2 bg-background rounded text-xs">
                  "Pronounce 'DEVONN' as 'Dev-on'"
                </code>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="secondary">Rule 3</Badge>
                  Filler Words
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-2">Allow natural discourse markers:</p>
                <code className="block p-2 bg-background rounded text-xs">
                  "Got it," "Let me see," "Sure thing"
                </code>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Strategic Deployment */}
      <Card className="border-cyan-500/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Zap className="h-5 w-5 text-cyan-500" />
            </div>
            <div>
              <CardTitle className="text-xl">2. Strategic Deployment (Hosting & Tools)</CardTitle>
              <CardDescription>
                Professional production environment recommendations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Feature</TableHead>
                <TableHead className="w-[200px]">Recommendation</TableHead>
                <TableHead>Why?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">
                  <Badge variant="outline">Low Latency</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Vapi</span>
                    <span className="text-muted-foreground">or</span>
                    <span className="font-semibold">Retell AI</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  Specifically built for voice; reduces that awkward "lag" between user speaking and AI responding
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  <Badge variant="outline">Custom Voices</Badge>
                </TableCell>
                <TableCell>
                  <span className="font-semibold">ElevenLabs</span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  Industry-standard for ultra-realistic, emotional voices that don't sound robotic
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  <Badge variant="outline">Free Hosting</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Vercel</span>
                    <span className="text-muted-foreground">or</span>
                    <span className="font-semibold">GitHub Pages</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  Host HTML/JS with high reliability at no cost
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Section 3: Human-in-the-Loop */}
      <Card className="border-orange-500/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Users className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <CardTitle className="text-xl">3. Human-in-the-Loop Escalation</CardTitle>
              <CardDescription>
                An AI that gets stuck creates a bad customer experience
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-orange-500" />
                  The "Panic" Trigger
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>If the user says <code className="bg-background px-1 rounded">"agent"</code>, <code className="bg-background px-1 rounded">"human"</code>, or <code className="bg-background px-1 rounded">"help"</code> twice, instruct the AI to:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Provide a direct phone number</li>
                  <li>Offer a link to live chat</li>
                  <li>Transfer to a human operator</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-orange-500" />
                  Verification Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>Always have the AI repeat back critical information:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Confirm date/time before booking</li>
                  <li>Repeat back names and numbers</li>
                  <li>Avoid AI hallucinations in bookings</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Automation */}
      <Card className="border-green-500/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Settings className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-xl">4. Connect to Your "Hands" (Automation)</CardTitle>
              <CardDescription>
                The automation layer is where you actually make money
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Use <strong>Make.com</strong> or <strong>Zapier</strong> to bridge the gap between voice conversations and actions:
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                <div className="p-2 rounded-full bg-green-500/10">
                  <Mic className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Trigger</p>
                  <p className="text-xs text-muted-foreground">AI Agent completes conversation</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <Settings className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Action</p>
                  <p className="text-xs text-muted-foreground">Extract Name, Email, Date</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                <div className="p-2 rounded-full bg-purple-500/10">
                  <Calendar className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Result</p>
                  <p className="text-xs text-muted-foreground">Add to Calendar + Send Email</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Industry Templates */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">5. Industry-Specific Voice Prompts</CardTitle>
              <CardDescription>
                Production-ready templates with escalation protocols and data collection
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <VoicePromptTemplates />
        </CardContent>
      </Card>

      {/* Resources */}
      <Card className="bg-muted/20">
        <CardHeader>
          <CardTitle className="text-lg">Recommended Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <a 
              href="https://elevenlabs.io" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-sm"
            >
              <ExternalLink className="h-4 w-4" />
              <span>ElevenLabs</span>
            </a>
            <a 
              href="https://vapi.ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-sm"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Vapi</span>
            </a>
            <a 
              href="https://retellai.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-sm"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Retell AI</span>
            </a>
            <a 
              href="https://make.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-sm"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Make.com</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceBestPracticesTab;
