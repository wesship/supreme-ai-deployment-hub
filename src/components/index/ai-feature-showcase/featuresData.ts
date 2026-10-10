
import { BrainCircuit, Network, Zap, Code2, Lock, BarChart } from 'lucide-react';

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  details: string[];
  image: string;
}

export const features: Feature[] = [
  {
    id: 'neural',
    title: 'Neural Network Processing',
    description: 'Process complex neural networks with optimized infrastructure for training and inference.',
    icon: BrainCircuit,
    color: 'from-blue-500 to-purple-600',
    details: [
      'Multi-GPU Training Support',
      'Distributed Processing',
      'Model Checkpointing',
      'Gradient Accumulation'
    ],
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31'
  },
  {
    id: 'vector',
    title: 'Vector Database Integration',
    description: 'Store and query high-dimensional vectors for semantic search and recommendation systems.',
    icon: Network,
    color: 'from-green-500 to-emerald-600',
    details: [
      'Similarity Search',
      'Clustering Operations',
      'Embedding Storage',
      'ANN Algorithms'
    ],
    image: 'https://images.unsplash.com/photo-1501139083538-0139583c060f'
  },
  {
    id: 'inference',
    title: 'Fast Inference Engine',
    description: 'Serve AI models with low-latency responses for real-time applications.',
    icon: Zap,
    color: 'from-amber-500 to-orange-600',
    details: [
      'Model Quantization',
      'Batched Prediction',
      'Adaptive Scaling',
      'Request Prioritization'
    ],
    image: 'https://images.unsplash.com/photo-1562408590-e32931084e23'
  },
  {
    id: 'security',
    title: 'Security & Governance',
    description: 'Implement robust security measures for model deployment and data protection.',
    icon: Lock,
    color: 'from-red-500 to-pink-600',
    details: [
      'Model Encryption',
      'Access Control',
      'Audit Logging',
      'Data Anonymization'
    ],
    image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3'
  },
  {
    id: 'pipeline',
    title: 'CI/CD Pipeline',
    description: 'Automated workflows for testing and deploying AI models to production.',
    icon: Code2,
    color: 'from-indigo-500 to-violet-600',
    details: [
      'Automated Testing',
      'Model Versioning',
      'Canary Deployments',
      'Rollback Mechanisms'
    ],
    image: 'https://images.unsplash.com/photo-1571171637578-41bc2dd41cd2'
  },
  {
    id: 'monitoring',
    title: 'Model Monitoring',
    description: 'Track model performance, drift, and operational metrics in production.',
    icon: BarChart,
    color: 'from-cyan-500 to-blue-600',
    details: [
      'Performance Metrics',
      'Drift Detection',
      'Alerting System',
      'Custom Dashboards'
    ],
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71'
  }
];
