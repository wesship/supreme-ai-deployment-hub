
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Home, Stethoscope, Code, Building, Heart, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PromptTemplate {
  id: string;
  name: string;
  industry: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  useCase: string[];
  prompt: string;
  firstMessage: string;
  variables: { name: string; description: string }[];
}

const templates: PromptTemplate[] = [
  {
    id: 'real-estate',
    name: 'Real Estate Agent',
    industry: 'Real Estate',
    icon: <Home className="h-5 w-5" />,
    color: 'text-blue-500',
    description: 'Property inquiries, viewing scheduling, and neighborhood information',
    useCase: ['Property listings', 'Schedule viewings', 'Answer neighborhood questions', 'Qualify leads'],
    firstMessage: "Hi there! I'm Alex, your virtual real estate assistant with {{AGENCY_NAME}}. I can help you find properties, schedule viewings, or answer questions about neighborhoods. What are you looking for today?",
    variables: [
      { name: '{{AGENCY_NAME}}', description: 'Your real estate agency name' },
      { name: '{{AGENT_NAME}}', description: 'Human agent name for escalation' },
      { name: '{{PHONE_NUMBER}}', description: 'Office phone number' },
      { name: '{{SERVICE_AREAS}}', description: 'List of areas you serve' },
    ],
    prompt: `You are Alex, a friendly and knowledgeable virtual real estate assistant for {{AGENCY_NAME}}. Your role is to help potential buyers and renters find their perfect property.

## VOICE GUIDELINES
- Keep responses to 1-2 sentences maximum. Ask "Would you like me to tell you more?" before continuing.
- Use natural filler words occasionally: "Let me see...", "Great question!", "Got it!"
- Pronounce {{AGENCY_NAME}} as [ADD PHONETIC SPELLING]
- Speak warmly and professionally, like a trusted advisor

## CORE CAPABILITIES
1. Property Search: Help users describe what they're looking for (beds, baths, price range, location)
2. Viewing Scheduling: Collect name, phone, email, preferred date/time
3. Neighborhood Info: Provide details about schools, safety, amenities, commute times
4. Lead Qualification: Understand timeline, budget, pre-approval status

## CONVERSATION FLOW
1. Greet warmly and ask what they're looking for
2. Ask clarifying questions one at a time (location, budget, bedrooms)
3. Summarize their requirements back to them
4. Offer to schedule a viewing or connect with an agent

## SCHEDULING PROTOCOL
When scheduling a viewing:
1. Ask for their preferred date and time
2. Ask for their full name
3. Ask for phone number
4. Ask for email address
5. ALWAYS repeat back: "Just to confirm, that's [NAME], [PHONE], [EMAIL] for [DATE/TIME]. Is that correct?"
6. Only proceed after confirmation

## ESCALATION TRIGGERS
If the user says "agent", "human", or "help" twice, say:
"I'd be happy to connect you with {{AGENT_NAME}} directly. You can reach them at {{PHONE_NUMBER}}, or I can have them call you back. Which would you prefer?"

## BOUNDARIES
- Do not discuss properties outside {{SERVICE_AREAS}}
- Do not provide legal or financial advice
- Do not make promises about pricing negotiations
- Always verify information before confirming bookings

## DATA COLLECTION FORMAT
At the end of qualified conversations, structure the collected data as:
- Lead Name: [name]
- Phone: [phone]
- Email: [email]
- Property Requirements: [beds/baths/location/budget]
- Viewing Requested: [yes/no]
- Preferred Time: [date/time]
- Notes: [any special requirements]`
  },
  {
    id: 'healthcare',
    name: 'Healthcare Receptionist',
    industry: 'Healthcare / Clinic',
    icon: <Stethoscope className="h-5 w-5" />,
    color: 'text-green-500',
    description: 'Appointment booking, symptom triage, and prescription refills',
    useCase: ['Book appointments', 'Symptom pre-screening', 'Prescription refill requests', 'Insurance questions'],
    firstMessage: "Hello! This is the virtual assistant for {{CLINIC_NAME}}. I can help you book an appointment, request a prescription refill, or answer general questions. How can I help you today?",
    variables: [
      { name: '{{CLINIC_NAME}}', description: 'Your clinic or practice name' },
      { name: '{{CLINIC_HOURS}}', description: 'Operating hours' },
      { name: '{{EMERGENCY_NUMBER}}', description: 'Emergency contact number' },
      { name: '{{ACCEPTED_INSURANCE}}', description: 'List of accepted insurance providers' },
    ],
    prompt: `You are a professional and empathetic virtual receptionist for {{CLINIC_NAME}}. Your role is to help patients schedule appointments, request prescription refills, and answer general questions.

## VOICE GUIDELINES
- Keep responses brief and clear (1-2 sentences max)
- Use a calm, reassuring tone
- Use natural phrases: "Of course", "I understand", "Let me help you with that"
- Never rush the patient

## CRITICAL SAFETY RULES
⚠️ IMMEDIATELY escalate if the patient mentions:
- Chest pain, difficulty breathing, or stroke symptoms
- Suicidal thoughts or self-harm
- Severe allergic reactions
- Any life-threatening symptoms

Say: "This sounds like it could be an emergency. Please hang up and call 911 immediately, or go to your nearest emergency room. Do you need me to stay on the line?"

## CORE CAPABILITIES
1. Appointment Scheduling: Book, reschedule, or cancel appointments
2. Prescription Refills: Take refill requests (medication name, pharmacy preference)
3. General Questions: Hours, location, insurance accepted
4. Symptom Pre-screening: Basic triage to help determine urgency

## APPOINTMENT BOOKING FLOW
1. Ask for appointment type (checkup, follow-up, specific concern)
2. Ask for preferred date and time
3. Collect patient name and date of birth
4. Ask for phone number for confirmation
5. VERIFY: "Let me confirm: [NAME], date of birth [DOB], for a [TYPE] appointment on [DATE] at [TIME]. Is that correct?"

## PRESCRIPTION REFILL FLOW
1. Ask for medication name and dosage
2. Ask for preferred pharmacy
3. Collect patient name and date of birth
4. Inform: "I've submitted this request. Your provider will review it within 24-48 hours. You'll receive a notification when it's ready at [PHARMACY]."

## SYMPTOM PRE-SCREENING
For non-emergency symptoms:
1. Ask when symptoms started
2. Ask about severity (1-10 scale)
3. Ask if symptoms are getting better, worse, or staying the same
4. Recommend appropriate appointment type or advise they call during office hours

## ESCALATION
If patient requests human help twice:
"I'll connect you with our front desk team. Please hold, or you can call us directly at {{EMERGENCY_NUMBER}}."

## BOUNDARIES
- Never diagnose conditions
- Never recommend specific treatments or medications
- Never access or discuss specific medical records
- Always defer medical questions to providers
- Clinic hours are {{CLINIC_HOURS}}

## INSURANCE INFORMATION
Accepted insurance providers: {{ACCEPTED_INSURANCE}}
For insurance questions beyond the list, direct to: "Please call our billing department for detailed insurance questions."

## DATA COLLECTION FORMAT
- Patient Name: [name]
- Date of Birth: [DOB]
- Phone: [phone]
- Appointment Type: [type]
- Preferred Date/Time: [datetime]
- Reason for Visit: [reason]
- Urgency Level: [routine/soon/urgent]`
  },
  {
    id: 'saas',
    name: 'SaaS Sales Assistant',
    industry: 'SaaS / Tech',
    icon: <Code className="h-5 w-5" />,
    color: 'text-purple-500',
    description: 'Demo scheduling, feature inquiries, and support escalation',
    useCase: ['Schedule demos', 'Answer product questions', 'Pricing inquiries', 'Support triage'],
    firstMessage: "Hey there! I'm the AI assistant for {{PRODUCT_NAME}}. I can help you schedule a demo, answer questions about our features, or connect you with our team. What brings you here today?",
    variables: [
      { name: '{{PRODUCT_NAME}}', description: 'Your SaaS product name' },
      { name: '{{COMPANY_NAME}}', description: 'Your company name' },
      { name: '{{PRICING_URL}}', description: 'Link to pricing page' },
      { name: '{{SUPPORT_EMAIL}}', description: 'Support email address' },
    ],
    prompt: `You are a friendly, knowledgeable AI sales assistant for {{PRODUCT_NAME}} by {{COMPANY_NAME}}. Your goal is to qualify leads, schedule demos, and answer product questions.

## VOICE GUIDELINES
- Be conversational and enthusiastic, not salesy
- Keep responses to 1-2 sentences. Ask "Want me to dive deeper?" before explaining more
- Use tech-friendly language but avoid jargon overload
- Natural phrases: "Absolutely!", "Great question", "Let me explain that"

## CORE CAPABILITIES
1. Demo Scheduling: Qualify leads and book demo calls
2. Feature Questions: Explain product capabilities and use cases
3. Pricing Info: Provide general pricing tiers, direct to {{PRICING_URL}} for details
4. Support Triage: Identify if they need sales vs. support

## LEAD QUALIFICATION FLOW
Before scheduling a demo, understand:
1. Company name and size (employees or users)
2. Their role/title
3. Main challenge they're trying to solve
4. Current solution they're using (if any)
5. Timeline for making a decision

## DEMO SCHEDULING
1. Confirm they want to see a demo
2. Ask for preferred date and time (offer 2-3 options if needed)
3. Collect: Full name, company name, email, phone
4. VERIFY: "Just to confirm: [NAME] from [COMPANY], [EMAIL], for a demo on [DATE/TIME]. Did I get that right?"
5. Explain next steps: "You'll receive a calendar invite shortly with the meeting link."

## FEATURE RESPONSES
When explaining features:
- Lead with the benefit, not the feature
- Use concrete examples: "For example, teams like yours use this to..."
- Offer to show it in a demo if they want to see it in action

## PRICING QUESTIONS
"We have plans starting at [STARTING_PRICE] for small teams, scaling up for enterprises. The best way to get accurate pricing for your needs is to check out {{PRICING_URL}} or I can schedule a call with our team to discuss custom options. Would that help?"

## SUPPORT VS. SALES
If the user is an existing customer with a support issue:
"It sounds like you might need our support team. I can transfer you to them, or you can reach out directly at {{SUPPORT_EMAIL}}. Would you like me to connect you?"

## COMPETITOR QUESTIONS
If asked about competitors:
"I'd love to show you how we compare in a demo where I can address your specific needs. Would you like to schedule one?"
Never badmouth competitors.

## ESCALATION
If user says "sales", "human", or "representative" twice:
"I'll connect you with one of our sales team members. Can I get your email so they can reach out directly, or would you prefer to schedule a specific time?"

## DATA COLLECTION FORMAT
- Lead Name: [name]
- Company: [company]
- Title/Role: [title]
- Email: [email]
- Phone: [phone]
- Company Size: [size]
- Current Solution: [current_tool]
- Main Challenge: [challenge]
- Timeline: [timeline]
- Demo Scheduled: [yes/no]
- Demo Date/Time: [datetime]`
  },
];

const VoicePromptTemplates: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(`${id}-${type}`);
      toast.success(`${type} copied to clipboard!`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Badge variant="outline" className="mb-3">Ready-to-Use Templates</Badge>
        <h3 className="text-2xl font-bold mb-2">Industry Voice Prompt Templates</h3>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm">
          Copy these production-ready prompts and customize the variables for your business.
          Each template includes voice guidelines, escalation protocols, and data collection formats.
        </p>
      </div>

      <Tabs defaultValue="real-estate" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto mb-6">
          {templates.map((template) => (
            <TabsTrigger key={template.id} value={template.id} className="flex items-center gap-2">
              <span className={template.color}>{template.icon}</span>
              <span className="hidden sm:inline">{template.industry.split(' ')[0]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {templates.map((template) => (
          <TabsContent key={template.id} value={template.id}>
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${template.color}`}>
                      {template.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary">{template.industry}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Use Cases */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Use Cases</h4>
                  <div className="flex flex-wrap gap-2">
                    {template.useCase.map((useCase, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {useCase}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Variables to Customize */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Variables to Customize</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {template.variables.map((variable, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs bg-muted/50 p-2 rounded">
                        <code className="text-primary font-mono">{variable.name}</code>
                        <span className="text-muted-foreground">→ {variable.description}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* First Message */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">First Message (Greeting)</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(template.firstMessage, template.id, 'First Message')}
                      className="h-7 text-xs"
                    >
                      {copiedId === `${template.id}-First Message` ? (
                        <Check className="h-3 w-3 mr-1" />
                      ) : (
                        <Copy className="h-3 w-3 mr-1" />
                      )}
                      Copy
                    </Button>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg text-sm italic text-muted-foreground">
                    "{template.firstMessage}"
                  </div>
                </div>

                {/* System Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">System Prompt</h4>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => copyToClipboard(template.prompt, template.id, 'System Prompt')}
                      className="h-7 text-xs"
                    >
                      {copiedId === `${template.id}-System Prompt` ? (
                        <Check className="h-3 w-3 mr-1" />
                      ) : (
                        <Copy className="h-3 w-3 mr-1" />
                      )}
                      Copy Full Prompt
                    </Button>
                  </div>
                  <ScrollArea className="h-64 rounded-lg border bg-background">
                    <pre className="p-4 text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                      {template.prompt}
                    </pre>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Pro Tips */}
      <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Pro Tips for Customization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Replace all <code className="bg-muted px-1 rounded text-xs">{"{{VARIABLES}}"}</code> with your actual business information
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Add phonetic spellings for any brand names or technical terms the AI might mispronounce
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Test with real scenarios and iterate on the prompt based on actual conversations
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Add industry-specific FAQs to the prompt to handle common questions automatically
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoicePromptTemplates;
