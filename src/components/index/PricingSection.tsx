
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, CreditCard, Cpu, Server, Users, Cloud, Shield } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const plans = [
  {
    name: "Community",
    description: "Perfect for individual developers and small projects",
    price: { monthly: 0, annual: 0 },
    features: [
      { name: "Core AI Deployment Framework", included: true },
      { name: "Basic Observability", included: true },
      { name: "Single Cloud Provider", included: true },
      { name: "Community Support", included: true },
      { name: "Auto-scaling", included: false },
      { name: "Advanced Security Features", included: false },
    ],
    cta: "Get Started",
    popular: false,
    icon: <Cpu className="h-5 w-5" />,
  },
  {
    name: "Professional",
    description: "For teams building production AI systems",
    price: { monthly: 99, annual: 79 },
    features: [
      { name: "Core AI Deployment Framework", included: true },
      { name: "Advanced Observability", included: true },
      { name: "Multi-Cloud Support", included: true },
      { name: "Priority Support", included: true },
      { name: "Auto-scaling", included: true },
      { name: "Advanced Security Features", included: false },
    ],
    cta: "Start Free Trial",
    popular: true,
    icon: <Server className="h-5 w-5" />,
  },
  {
    name: "Enterprise",
    description: "For organizations with advanced AI deployment needs",
    price: { monthly: 299, annual: 249 },
    features: [
      { name: "Core AI Deployment Framework", included: true },
      { name: "Enterprise Observability", included: true },
      { name: "Multi-Cloud Support", included: true },
      { name: "24/7 Dedicated Support", included: true },
      { name: "Auto-scaling", included: true },
      { name: "Advanced Security Features", included: true },
    ],
    cta: "Contact Sales",
    popular: false,
    icon: <Users className="h-5 w-5" />,
  }
];

const PricingSection: React.FC = () => {
  const [annual, setAnnual] = useState(false);
  
  return (
    <section className="py-20 bg-gradient-to-b from-background to-secondary/10">
      <Container maxWidth="2xl">
        <SectionHeading 
          centered
          animate
          tag="Pricing"
          subheading="Choose the right plan for your AI deployment needs"
        >
          Flexible Pricing Plans
        </SectionHeading>
        
        <div className="flex justify-center mt-6 mb-10">
          <div className="flex items-center space-x-3 bg-secondary/20 p-1 rounded-full">
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${!annual ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              Monthly
            </span>
            <Switch 
              checked={annual} 
              onCheckedChange={setAnnual} 
              className="data-[state=checked]:bg-primary"
            />
            <span className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${annual ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              Annual
              <Badge variant="outline" className="ml-1 h-5 text-[10px] bg-primary/20 text-primary">
                20% OFF
              </Badge>
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className={`relative ${plan.popular ? 'md:-mt-4 md:mb-4' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <Badge className="bg-[#00FF41] text-black px-3 py-1 text-xs font-semibold">
                    MOST POPULAR
                  </Badge>
                </div>
              )}
              
              <Card className={`h-full overflow-hidden ${plan.popular ? 'border-[#00FF41] border-2 shadow-[0_0_15px_rgba(0,255,65,0.2)]' : 'border-primary/10'}`}>
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-full bg-primary/10 text-primary">
                        {plan.icon}
                      </div>
                      <h3 className="text-xl font-semibold">{plan.name}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </CardHeader>
                
                <CardContent className="pt-4">
                  <div className="mb-6">
                    <div className="flex items-end">
                      <span className="text-3xl font-bold">${annual ? plan.price.annual : plan.price.monthly}</span>
                      {(annual ? plan.price.annual : plan.price.monthly) > 0 && (
                        <span className="text-muted-foreground ml-2 mb-1">/month</span>
                      )}
                    </div>
                    {(annual ? plan.price.annual : plan.price.monthly) > 0 && annual && (
                      <p className="text-xs text-muted-foreground mt-1">Billed annually (${plan.price.annual * 12}/year)</p>
                    )}
                  </div>
                  
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start">
                        {feature.included ? (
                          <Check className="h-5 w-5 mr-2 text-[#00FF41] shrink-0" />
                        ) : (
                          <X className="h-5 w-5 mr-2 text-muted-foreground shrink-0" />
                        )}
                        <span className={feature.included ? "" : "text-muted-foreground"}>
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter>
                  <Button 
                    className={`w-full ${plan.popular ? 'bg-[#00FF41] text-black hover:bg-[#00FF41]/90' : ''}`}
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {plan.popular ? <CreditCard className="mr-2 h-4 w-4" /> : null}
                    {plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
        
        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
            All plans include the core D3VONN.IO framework features. Need a custom solution? 
            <a href="/contact" className="text-primary ml-1 hover:underline">Contact our sales team</a>.
          </p>
        </div>
      </Container>
    </section>
  );
};

export default PricingSection;
