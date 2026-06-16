import type { CommandRegistry } from './types.js';

const c = (code: string, category: string, description: string, approvalLevel: 0|1|2|3, extra: Partial<{regulated:boolean;aliases:string[];conflictsWith:string[]}> = {}) => ({ code, category, description, approvalLevel, ...extra });

export const registry: CommandRegistry = {
  version: '1.0.0',
  commands: [
    c('PRIMETIME','project','Apply complete PRIMETIME project context.',0),
    c('PROJECT-SCAN','project','Review related modules, plans, workflows, and decisions.',0),
    c('PROJECT-STATUS','project','Show completed, active, blocked, and pending work.',0),
    c('PROJECT-GAP','project','Identify missing components and weak connections.',0),
    c('PROJECT-NEXT','project','Recommend the best next action.',0),
    c('CRM-AUDIT','crm','Audit CRM architecture, data, and workflows.',0,['CRM-REVIEW'] as never),
    c('CRM-PIPELINE','crm','Design or improve pipeline stages.',1),
    c('TOP25','sales','Build and organize a Top 25 prospect workflow.',1),
    c('LEAD-GEN','sales','Generate lead-generation strategies.',1),
    c('COMPLIANCE-CHECK','compliance','Review licensing, advertising, and documentation risk.',2,{regulated:true}),
    c('TCPA-CHECK','compliance','Review automated call and text consent concerns.',3,{regulated:true}),
    c('DNC-CHECK','compliance','Flag Do Not Call restrictions.',3,{regulated:true}),
    c('PRIVACY-CHECK','compliance','Review personal-data collection and use.',2,{regulated:true}),
    c('HUMAN-APPROVAL','control','Require human approval before execution.',2),
    c('ESCALATE-LICENSED','control','Route regulated decisions to a licensed representative.',3,{regulated:true}),
    c('AGENT-DESIGN','agent','Design an AI agent and its operating boundaries.',1),
    c('AGENT-ROUTER','agent','Route work to the correct specialist agent.',1),
    c('N8N-BUILD','automation','Design an n8n workflow.',1),
    c('SMS-SEQUENCE','messaging','Create a multistep SMS sequence.',2,{conflictsWith:['AUTO-SEND']}),
    c('EMAIL-SEQUENCE','messaging','Create an automated email sequence.',2),
    c('PRODUCTION-READY','development','Check production readiness.',1),
    c('TABLE','format','Return a table.',0,{conflictsWith:['JSON','YAML']}),
    c('JSON','format','Return JSON.',0,{conflictsWith:['TABLE','YAML']}),
    c('YAML','format','Return YAML.',0,{conflictsWith:['TABLE','JSON']}),
    c('TECHNICAL','format','Use engineering-level detail.',0,{conflictsWith:['BEGINNER']}),
    c('BEGINNER','format','Explain for a beginner.',0,{conflictsWith:['TECHNICAL']})
  ],
  masterCodes: {
    'PRIMETIME-360':['PROJECT-SCAN','PROJECT-STATUS','PROJECT-GAP','COMPLIANCE-CHECK','PROJECT-NEXT'],
    'CRM-360':['CRM-AUDIT','CRM-PIPELINE','PRODUCTION-READY'],
    'AUTOMATION-360':['N8N-BUILD','HUMAN-APPROVAL'],
    'COMPLIANCE-360':['COMPLIANCE-CHECK','TCPA-CHECK','DNC-CHECK','PRIVACY-CHECK','ESCALATE-LICENSED'],
    'LEADS-360':['TOP25','LEAD-GEN','CRM-PIPELINE']
  }
};
