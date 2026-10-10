
import React from 'react';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BadgeCheck } from 'lucide-react';

const faqData = [
  {
    question: "What are the minimum system requirements?",
    answer: "For local development, we recommend at least 16GB RAM, 4-core CPU, and 50GB storage. For production, a Kubernetes cluster with at least 3 nodes is recommended, each with 8 CPU cores and 32GB RAM."
  },
  {
    question: "Does D3VONN.IO work with any cloud provider?",
    answer: "Yes, D3VONN.IO is cloud-agnostic and works with all major cloud providers including AWS, GCP, Azure, and others. It can also be deployed on on-premises Kubernetes clusters."
  },
  {
    question: "How does the framework handle model versioning?",
    answer: "D3VONN.IO includes built-in support for model versioning through its integration with MLflow. It tracks model versions, parameters, and metrics, and provides tools for model promotion through environments."
  },
  {
    question: "Is there support for A/B testing AI models?",
    answer: "Yes, the framework supports A/B testing through the Argo Rollouts component, which allows for canary deployments and traffic splitting between different model versions."
  },
  {
    question: "How is security handled in D3VONN.IO?",
    answer: "Security is implemented at multiple layers including network policies, Istio authorization policies, mTLS encryption, API authentication through Kong, and RBAC for Kubernetes resources."
  }
];

const FAQSection: React.FC = () => {
  return (
    <section className="py-20 bg-secondary/20">
      <Container maxWidth="2xl">
        <SectionHeading 
          centered
          animate 
          tag="FAQ"
          subheading="Common questions about the D3VONN.IO Framework"
        >
          Frequently Asked Questions
        </SectionHeading>
        
        <div className="mt-12 max-w-3xl mx-auto">
          {faqData.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * i }}
              className="mb-4"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BadgeCheck className="w-5 h-5 text-primary" />
                    {faq.question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
};

export default FAQSection;
