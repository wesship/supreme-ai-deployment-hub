
import { ChatMessage, Intent, ConversationContext } from './types';
import { toast } from 'sonner';
import { ENTITY_TYPES } from './constants';
import { getSentimentResponseModifier } from './sentimentAnalyzer';
import { getFallbackResponse, DEFAULT_FALLBACK_STRATEGY } from './fallbackManager';

interface ResponseGeneratorProps {
  getDeploymentSummary: () => string;
  isClusterConnected: boolean;
  apiConfigs: {
    name: string;
    endpoint: string;
    isConnected: boolean;
  }[];
  isAnyAPIConnected: boolean;
  conversationContext: ConversationContext;
}

export const generateResponse = (
  intent: Intent, 
  message: string,
  props: ResponseGeneratorProps
): ChatMessage => {
  const { 
    getDeploymentSummary, 
    isClusterConnected, 
    apiConfigs, 
    isAnyAPIConnected, 
    conversationContext 
  } = props;
  
  // Check if we should use fallback response
  const fallbackResponse = getFallbackResponse(conversationContext.failedIntentCount || 0);
  
  // Start with a default response
  const response: ChatMessage = {
    content: fallbackResponse || "", // Use fallback if available
    role: 'assistant'
  };
  
  // If using fallback, return early
  if (fallbackResponse) {
    return response;
  }
  
  // Use extracted entities to personalize responses
  const mentionedServices = intent.entities?.filter(e => e.type === ENTITY_TYPES.SERVICE).map(e => e.value) || [];
  const mentionedPlatforms = intent.entities?.filter(e => e.type === ENTITY_TYPES.PLATFORM).map(e => e.value) || [];
  const mentionedActions = intent.entities?.filter(e => e.type === ENTITY_TYPES.ACTION).map(e => e.value) || [];
  
  // Get sentiment modifier based on user's detected sentiment
  const sentimentModifier = conversationContext.lastUserSentiment 
    ? getSentimentResponseModifier(conversationContext.lastUserSentiment)
    : "";
  
  switch (intent.type) {
    case 'greeting':
      response.content = sentimentModifier + "Hello! Welcome to DEVONN.AI. I'm your AI assistant for deploying AI systems and managing API integrations. How can I help you today?";
      
      // If returning user (more than 5 messages), personalize greeting
      if (conversationContext.messageCount && conversationContext.messageCount > 5) {
        response.content = "Welcome back! I'm ready to continue helping with your AI deployment and integration needs. What would you like to work on now?";
      }
      break;
      
    case 'help':
      if (mentionedServices.length > 0) {
        response.content = sentimentModifier + `I can help you with ${mentionedServices.join(", ")}. What specifically would you like to know?`;
      } else if (mentionedActions.length > 0) {
        response.content = sentimentModifier + `I can help you ${mentionedActions.join(", ")} your AI systems. Would you like specific guidance?`;
      } else {
        response.content = sentimentModifier + "I can help you with deploying AI systems, managing Kubernetes clusters, connecting to APIs, monitoring services, and more. What specific assistance do you need?";
      }
      
      response.type = 'buttons';
      if (mentionedServices.includes('kubernetes') || mentionedServices.includes('k8s')) {
        response.buttons = [
          { id: 'b1', label: 'Kubernetes Deployment', action: () => {} }, // Will be set in ChatContext
          { id: 'b2', label: 'Cluster Management', action: () => {} },
          { id: 'b3', label: 'API Integration', action: () => {} },
          { id: 'b4', label: 'System Status', action: () => {} },
        ];
      } else {
        response.buttons = [
          { id: 'b1', label: 'Deployment Help', action: () => {} },
          { id: 'b2', label: 'API Integration', action: () => {} },
          { id: 'b3', label: 'Cluster Management', action: () => {} },
          { id: 'b4', label: 'System Status', action: () => {} },
        ];
      }
      break;
      
    case 'pricing':
      response.content = "DEVONN.AI offers several pricing tiers based on your deployment and integration needs:";
      response.type = 'links';
      response.links = [
        { url: "#", label: "Basic Plan - $99/month" },
        { url: "#", label: "Professional Plan - $299/month" },
        { url: "#", label: "Enterprise Plan - Custom pricing" },
      ];
      break;
      
    case 'features':
      response.content = "DEVONN.AI offers the following key features:";
      response.type = 'text';
      response.content += "\n\n• Kubernetes deployment orchestration\n• External API integration\n• Service monitoring and observability\n• Istio service mesh integration\n• Kong API gateway management\n• Canary deployments with Argo Rollouts\n• Comprehensive logging system";
      break;
      
    case 'deployment':
      if (mentionedPlatforms.length > 0) {
        const platform = mentionedPlatforms[0];
        response.content = `To deploy an AI system on ${platform}, you'll need to configure your DEVONN.AI settings for ${platform} integration. Would you like me to help you set up the ${platform} connection?`;
      } else if (mentionedServices.length > 0) {
        const service = mentionedServices[0];
        response.content = `Deploying with ${service} is a great choice! DEVONN.AI provides streamlined integration with ${service}. Would you like to see our ${service} deployment guide?`;
      } else {
        response.content = "To deploy an AI system using DEVONN.AI, navigate to the Deployment Dashboard where you can connect to your Kubernetes cluster and follow our step-by-step deployment process. Would you like me to walk you through it?";
      }
      
      if (isClusterConnected) {
        response.content += "\n\nI notice you're already connected to a Kubernetes cluster. " + getDeploymentSummary();
      }
      break;
      
    case 'api':
      if (apiConfigs.length > 0) {
        response.content = `I see you have ${apiConfigs.length} API configurations set up. `;
        if (isAnyAPIConnected) {
          const connectedApis = apiConfigs.filter(api => api.isConnected);
          response.content += `${connectedApis.length} of them are currently connected.`;
        } else {
          response.content += "None of them are currently connected.";
        }
        response.content += "\n\nYou can manage your API connections by clicking on the API Management section. Would you like to add a new API connection?";
      } else {
        response.content = "To connect to external APIs, you can use our API Management section. Would you like to add a new API connection now?";
      }
      response.type = 'buttons';
      response.buttons = [
        { id: 'api1', label: 'Add New API', action: () => {
            toast.info("Navigate to API Management to add new APIs");
          } 
        },
        { id: 'api2', label: 'View API Status', action: () => {} }, // Will be set in ChatContext
      ];
      break;

    case 'status':
      response.content = "Here's the current status of your DEVONN.AI system:\n\n";
      
      // Add deployment status if available
      response.content += getDeploymentSummary() + "\n\n";
      
      // Add API status if there are any configured
      if (apiConfigs.length > 0) {
        response.content += `API Integrations: ${apiConfigs.length} configured, ${apiConfigs.filter(api => api.isConnected).length} connected.\n\n`;
      } else {
        response.content += "API Integrations: None configured.\n\n";
      }
      
      // This will be added in the ChatContext with process data
      response.content += `System Processes: [processCount] running.`;
      break;
      
    case 'technical':
      if (mentionedServices.length > 0) {
        const services = mentionedServices.join(", ");
        response.content = `I see you're interested in ${services}. DEVONN.AI provides robust support for ${services}. Would you like specific technical documentation or implementation guidance?`;
      } else if (mentionedPlatforms.length > 0) {
        const platforms = mentionedPlatforms.join(", ");
        response.content = `DEVONN.AI can deploy to ${platforms} environments. Would you like information about our ${platforms} integration capabilities?`;
      } else {
        response.content = "I understand you have a technical question. DEVONN.AI supports various technologies including Kubernetes, Istio, Kong, Prometheus, Grafana, Jaeger, and external API integrations. Could you provide more specific details about your question?";
      }
      break;
      
    case 'farewell':
      response.content = "Thank you for using DEVONN.AI Assistant. If you need any further assistance with deployments or API integrations, feel free to ask. Have a great day!";
      break;
      
    default:
      response.content = "I'm not sure I understand. Could you rephrase your question or select from common topics?";
      response.type = 'buttons';
      response.buttons = [
        { id: 'b1', label: 'Deployment', action: () => {} },
        { id: 'b2', label: 'API Integration', action: () => {} },
        { id: 'b3', label: 'Help', action: () => {} },
      ];
  }
  
  return response;
};
