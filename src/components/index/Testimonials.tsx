
import React from 'react';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

const testimonialsData = [
  {
    quote: "D3VONN.IO transformed how we deploy machine learning models. We reduced our deployment time from days to minutes.",
    name: "Sarah Johnson",
    role: "CTO, DataStream AI",
    logo: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMyMjIyMjIiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZmlsbD0iIzAwRkY0MSI+RFM8L3RleHQ+PC9zdmc+",
    rating: 5
  },
  {
    quote: "The observability stack integration saved us countless hours of troubleshooting and helped us identify performance bottlenecks immediately.",
    name: "Michael Chen",
    role: "Lead DevOps Engineer, TechFusion",
    logo: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMzMzMzMzMiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZmlsbD0iIzAwRkY0MSI+VEY8L3RleHQ+PC9zdmc+",
    rating: 5
  },
  {
    quote: "The security features of D3VONN.IO gave us the confidence to deploy sensitive financial models in production environments.",
    name: "Elena Rodriguez",
    role: "Head of AI, FinTech Solutions",
    logo: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiM0NDQ0NDQiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZmlsbD0iIzAwRkY0MSI+RlM8L3RleHQ+PC9zdmc+",
    rating: 4
  }
];

const Testimonials: React.FC = () => {
  const renderStars = (rating: number) => {
    return Array(5).fill(0).map((_, i) => (
      <svg 
        key={i} 
        className={`w-4 h-4 ${i < rating ? 'text-[#00FF41]' : 'text-gray-400'}`} 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor"
      >
        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
      </svg>
    ));
  };

  return (
    <section className="py-20 bg-gradient-to-b from-secondary/20 to-background">
      <Container maxWidth="2xl">
        <SectionHeading 
          centered
          animate 
          tag="Testimonials"
          subheading="What our users say about D3VONN.IO Framework"
        >
          <div className="flex items-center justify-center gap-2">
            User Feedback
            <Sparkles className="h-5 w-5 text-[#00FF41]" />
          </div>
        </SectionHeading>
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonialsData.map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              <Card className="h-full border-2 border-primary/5 hover:border-primary/20 transition-colors bg-black/40 backdrop-blur-sm overflow-visible">
                <CardContent className="pt-6 relative">
                  {/* Company Logo - Positioned above the card */}
                  <div className="absolute -top-10 left-6 w-16 h-16 rounded-full border-4 border-background p-1 bg-black shadow-lg">
                    <img 
                      src={testimonial.logo} 
                      alt={`${testimonial.name}'s company`} 
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  
                  {/* Rating stars */}
                  <div className="flex justify-end mb-4">
                    <div className="flex space-x-1">
                      {renderStars(testimonial.rating)}
                    </div>
                  </div>
                  
                  <div className="mb-4 text-4xl text-primary/20">"</div>
                  <p className="italic text-muted-foreground mb-6">{testimonial.quote}</p>
                  
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{testimonial.name}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs text-primary border border-primary/20">
                        Verified
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
};

export default Testimonials;
