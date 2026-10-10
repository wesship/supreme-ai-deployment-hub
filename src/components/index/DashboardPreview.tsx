
import React from 'react';
import { motion } from 'framer-motion';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Sample data for charts
const metricsData = [
  { name: 'Mon', cpu: 45, memory: 60 },
  { name: 'Tue', cpu: 55, memory: 65 },
  { name: 'Wed', cpu: 65, memory: 70 },
  { name: 'Thu', cpu: 70, memory: 75 },
  { name: 'Fri', cpu: 60, memory: 68 },
  { name: 'Sat', cpu: 50, memory: 62 },
  { name: 'Sun', cpu: 48, memory: 60 },
];

const DashboardPreview: React.FC = () => {
  return (
    <section id="dashboard-preview" className="py-20 bg-gradient-to-b from-background/50 to-secondary/20">
      <Container maxWidth="2xl">
        <SectionHeading 
          centered 
          animate 
          tag="Analytics"
          subheading="Real-time metrics from your AI deployment environment"
        >
          Dashboard Preview
        </SectionHeading>
        
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.5, delay: 0.1 }}
            className="col-span-1"
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Deployment Status</CardTitle>
                <CardDescription>Current system health and metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">CPU Usage</span>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-primary">68%</span>
                      <div className="w-24 h-2 ml-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: "68%" }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Memory</span>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-blue-500">72%</span>
                      <div className="w-24 h-2 ml-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: "72%" }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Storage</span>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-green-500">45%</span>
                      <div className="w-24 h-2 ml-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: "45%" }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Network</span>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-amber-500">86%</span>
                      <div className="w-24 h-2 ml-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: "86%" }}></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="dashboard-stat bg-green-50 dark:bg-green-900/20">
                    <span className="dashboard-stat-value text-green-600 dark:text-green-400">18</span>
                    <span className="dashboard-stat-label">Services Online</span>
                  </div>
                  <div className="dashboard-stat bg-red-50 dark:bg-red-900/20">
                    <span className="dashboard-stat-value text-red-600 dark:text-red-400">2</span>
                    <span className="dashboard-stat-label">Alerts</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
                <CardDescription>7-day resource utilization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metricsData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--secondary)" opacity={0.2} />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                      <YAxis stroke="var(--muted-foreground)" />
                      <Tooltip />
                      <Line type="monotone" dataKey="cpu" stroke="var(--primary)" strokeWidth={2} activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="memory" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </Container>
    </section>
  );
};

export default DashboardPreview;
