
import { Entity } from './types';
import { 
  ENTITY_TYPES, 
  SERVICE_ENTITIES, 
  PLATFORM_ENTITIES, 
  ACTION_ENTITIES, 
  TIME_PERIOD_ENTITIES 
} from './constants';

export const extractEntities = (message: string): Entity[] => {
  const entities: Entity[] = [];
  const lowerMessage = message.toLowerCase();
  
  // Extract service entities
  SERVICE_ENTITIES.forEach(service => {
    const serviceRegex = new RegExp(`\\b${service}\\b`, 'gi');
    let match;
    while ((match = serviceRegex.exec(message)) !== null) {
      entities.push({
        type: ENTITY_TYPES.SERVICE,
        value: service,
        position: {
          start: match.index,
          end: match.index + service.length
        }
      });
    }
  });
  
  // Extract platform entities
  PLATFORM_ENTITIES.forEach(platform => {
    const platformRegex = new RegExp(`\\b${platform}\\b`, 'gi');
    let match;
    while ((match = platformRegex.exec(message)) !== null) {
      entities.push({
        type: ENTITY_TYPES.PLATFORM,
        value: platform,
        position: {
          start: match.index,
          end: match.index + platform.length
        }
      });
    }
  });
  
  // Extract action entities
  ACTION_ENTITIES.forEach(action => {
    const actionRegex = new RegExp(`\\b${action}\\b`, 'gi');
    let match;
    while ((match = actionRegex.exec(message)) !== null) {
      entities.push({
        type: ENTITY_TYPES.ACTION,
        value: action,
        position: {
          start: match.index,
          end: match.index + action.length
        }
      });
    }
  });
  
  // Extract time period entities
  TIME_PERIOD_ENTITIES.forEach(period => {
    const periodRegex = new RegExp(`\\b${period}\\b`, 'gi');
    let match;
    while ((match = periodRegex.exec(message)) !== null) {
      entities.push({
        type: ENTITY_TYPES.TIME_PERIOD,
        value: period,
        position: {
          start: match.index,
          end: match.index + period.length
        }
      });
    }
  });
  
  // Extract numbers (could be useful for quantity-related requests)
  const numberMatches = message.match(/\b\d+\b/g);
  if (numberMatches) {
    numberMatches.forEach(num => {
      const numIndex = message.indexOf(num);
      entities.push({
        type: ENTITY_TYPES.NUMBER,
        value: num,
        position: {
          start: numIndex,
          end: numIndex + num.length
        }
      });
    }); 
  }
  
  return entities;
};
