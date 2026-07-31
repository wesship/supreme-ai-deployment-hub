
import React from 'react';
import { Helmet } from 'react-helmet';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Users2, Award, Target, Coffee } from 'lucide-react';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const About: React.FC = () => {
  const teamMembers = [
    {
      name: "Alex Morgan",
      role: "Founder & Lead Architect",
      image: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d",
      bio: "Former ML Ops engineer with 10+ years of experience deploying AI systems at scale."
    },
    {
      name: "Sarah Chen",
      role: "Head of AI Research",
      image: "https://images.unsplash.com/photo-1649972904349-6e44c42644a7",
      bio: "PhD in Computer Science specializing in ML infrastructure and distributed systems."
    },
    {
      name: "Michael Kim",
      role: "Lead DevOps Engineer",
      image: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b",
      bio: "Kubernetes expert with experience at major cloud providers designing resilient systems."
    }
  ];

  return (
    <>
      <D3vonnPageBanner title="About D3VONN.IO" />
      <Helmet>
        <title>About D3VONN.IO</title>
      </Helmet>
      <Container>
        <SectionHeading
          subheading="Learn about our mission and the team behind D3VONN.IO"
        >
          About Us
        </SectionHeading>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 py-8 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl font-display font-semibold mb-4">Our Mission</h2>
            <p className="text-muted-foreground mb-4">
              D3VONN.IO was founded in 2023 with a simple but powerful mission: to make AI deployment accessible, reliable, and efficient for organizations of all sizes.
            </p>
            <p className="text-muted-foreground mb-4">
              We believe that the future of AI lies not just in model development, but in creating robust infrastructure that allows those models to deliver real value in production environments.
            </p>
            <p className="text-muted-foreground">
              Our framework bridges the gap between research and real-world applications, empowering teams to focus on innovation rather than infrastructure challenges.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                <Users2 className="h-10 w-10 text-primary mb-4" />
                <h3 className="font-semibold">25+</h3>
                <p className="text-sm text-muted-foreground">Team Members</p>
              </CardContent>
            </Card>
            
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                <Award className="h-10 w-10 text-primary mb-4" />
                <h3 className="font-semibold">15+</h3>
                <p className="text-sm text-muted-foreground">Industry Awards</p>
              </CardContent>
            </Card>
            
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                <Target className="h-10 w-10 text-primary mb-4" />
                <h3 className="font-semibold">100+</h3>
                <p className="text-sm text-muted-foreground">Successful Deployments</p>
              </CardContent>
            </Card>
            
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                <Coffee className="h-10 w-10 text-primary mb-4" />
                <h3 className="font-semibold">∞</h3>
                <p className="text-sm text-muted-foreground">Cups of Coffee</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
        
        <SectionHeading
          tag="Our Team"
          subheading="Meet the experts behind D3VONN.IO"
          centered
        >
          Leadership Team
        </SectionHeading>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8">
          {teamMembers.map((member, i) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}
            >
              <Card className="overflow-hidden h-full transition-all hover:shadow-lg">
                <div className="aspect-[4/3] relative overflow-hidden">
                  <img 
                    src={member.image} 
                    alt={member.name} 
                    className="object-cover w-full h-full"
                  />
                </div>
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg">{member.name}</h3>
                  <p className="text-primary text-sm mb-2">{member.role}</p>
                  <p className="text-muted-foreground text-sm">{member.bio}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </Container>
    </>
  );
};

export default About;        <section className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-3xl border border-blue-500/20 bg-blue-950/10">
          <img
            src="/illustrations/governed-operations.svg"
            alt="D3VONN.IO's supervised-autonomy philosophy: every consequential agent action passes a human approval checkpoint"
            className="h-auto w-full"
            loading="lazy"
          />
        </section>


