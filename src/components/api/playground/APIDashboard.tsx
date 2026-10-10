
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowRight, Activity, Clock, CheckCircle, XCircle } from 'lucide-react';

// Mock data - in a real app, this would come from your API tracking
const recentActivity = [
  { id: 1, api: 'User API', method: 'GET', endpoint: '/users', status: '200 OK', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
  { id: 2, api: 'Product API', method: 'POST', endpoint: '/products', status: '201 Created', timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
  { id: 3, api: 'Order API', method: 'GET', endpoint: '/orders', status: '200 OK', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: 4, api: 'Auth API', method: 'POST', endpoint: '/login', status: '401 Unauthorized', timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
];

const methodStats = [
  { name: 'GET', count: 45 },
  { name: 'POST', count: 30 },
  { name: 'PUT', count: 12 },
  { name: 'DELETE', count: 8 },
  { name: 'PATCH', count: 5 },
];

const statusStats = [
  { name: 'Success', value: 75 },
  { name: 'Error', value: 25 },
];

const COLORS = ['#10b981', '#ef4444'];

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return new Intl.RelativeTimeFormat('en', { style: 'long' }).format(
    Math.round((date.getTime() - Date.now()) / (1000 * 60)),
    'minute'
  );
};

const getMethodClass = (method: string) => {
  switch (method) {
    case 'GET': return 'method-get';
    case 'POST': return 'method-post';
    case 'PUT': return 'method-put';
    case 'DELETE': return 'method-delete';
    case 'PATCH': return 'method-patch';
    default: return '';
  }
};

const getStatusClass = (status: string) => {
  if (status.startsWith('2')) return 'status-success';
  if (status.startsWith('4')) return 'status-error';
  if (status.startsWith('5')) return 'status-error';
  return '';
};

const APIDashboard: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>API Dashboard</CardTitle>
        <CardDescription>Overview of your API usage and activity</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
            <TabsTrigger value="stats">API Statistics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="activity" className="space-y-4">
            <motion.div 
              className="overflow-hidden"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-lg font-medium mb-2 flex items-center">
                <Clock className="w-5 h-5 mr-2" /> 
                Recent API Calls
              </h3>
              <div className="bg-secondary/50 rounded-md p-4 overflow-auto max-h-[320px]">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getMethodClass(activity.method)}`}>
                          {activity.method}
                        </span>
                        <span className="font-medium">{activity.api}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {activity.endpoint}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-xs px-2 py-0.5 rounded-md ${getStatusClass(activity.status)}`}>
                        {activity.status}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </TabsContent>
          
          <TabsContent value="stats" className="space-y-4">
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-secondary/50 rounded-md p-4">
                <h3 className="text-lg font-medium mb-2 flex items-center">
                  <Activity className="w-5 h-5 mr-2" /> 
                  API Methods
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={methodStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--background)', 
                        borderColor: 'var(--border)',
                        borderRadius: '6px'
                      }} 
                    />
                    <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="bg-secondary/50 rounded-md p-4">
                <h3 className="text-lg font-medium mb-2 flex items-center">
                  <div className="flex gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" /> 
                    <XCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <span className="ml-2">Status Distribution</span>
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={statusStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {statusStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--background)', 
                        borderColor: 'var(--border)',
                        borderRadius: '6px'
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default APIDashboard;
