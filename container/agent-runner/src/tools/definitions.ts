import fs from 'fs';
import path from 'path';
import { CronExpressionParser } from 'cron-parser';
import { MESSAGES_DIR, TASKS_DIR, IPC_DIR, writeIpcFile } from './ipc.js';
import { AgentTool } from '../types.js';

export const sendMessage: AgentTool<{ text: string; sender?: string }, string> = {
  name: 'send_message',
  description: "Send a message to the user or group immediately while you're still running. Use this for progress updates or to send multiple messages.",
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The message text to send' },
      sender: { type: 'string', description: 'Your role/identity name' },
    },
    required: ['text'],
  },
  execute: async (args) => {
    const chatJid = process.env.NANOCLAW_CHAT_JID!;
    const groupFolder = process.env.NANOCLAW_GROUP_FOLDER!;
    
    const data = {
      type: 'message',
      chatJid,
      text: args.text,
      sender: args.sender,
      groupFolder,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(MESSAGES_DIR, data);
    return 'Message sent.';
  },
};

export const scheduleTask: AgentTool<{
  prompt: string;
  schedule_type: 'cron' | 'interval' | 'once';
  schedule_value: string;
  context_mode?: 'group' | 'isolated';
  target_group_jid?: string;
}, string> = {
  name: 'schedule_task',
  description: 'Schedule a recurring or one-time task.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'What the agent should do when the task runs.' },
      schedule_type: { type: 'string', enum: ['cron', 'interval', 'once'] },
      schedule_value: { type: 'string' },
      context_mode: { type: 'string', enum: ['group', 'isolated'], default: 'group' },
      target_group_jid: { type: 'string', description: '(Main group only) JID of the group to schedule the task for.' },
    },
    required: ['prompt', 'schedule_type', 'schedule_value'],
  },
  execute: async (args) => {
    const chatJid = process.env.NANOCLAW_CHAT_JID!;
    const groupFolder = process.env.NANOCLAW_GROUP_FOLDER!;
    const isMain = process.env.NANOCLAW_IS_MAIN === '1';

    // Validation logic (simplified for shared tool)
    if (args.schedule_type === 'cron') {
      CronExpressionParser.parse(args.schedule_value);
    }

    const targetJid = isMain && args.target_group_jid ? args.target_group_jid : chatJid;

    const data = {
      type: 'schedule_task',
      prompt: args.prompt,
      schedule_type: args.schedule_type,
      schedule_value: args.schedule_value,
      context_mode: args.context_mode || 'group',
      targetJid,
      createdBy: groupFolder,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);
    return `Task scheduled: ${args.schedule_type} - ${args.schedule_value}`;
  },
};

export const listTasks: AgentTool<Record<string, never>, string> = {
  name: 'list_tasks',
  description: 'List all scheduled tasks.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const groupFolder = process.env.NANOCLAW_GROUP_FOLDER!;
    const isMain = process.env.NANOCLAW_IS_MAIN === '1';
    const tasksFile = path.join(IPC_DIR, 'current_tasks.json');

    if (!fs.existsSync(tasksFile)) return 'No scheduled tasks found.';

    const allTasks = JSON.parse(fs.readFileSync(tasksFile, 'utf-8'));
    const tasks = isMain ? allTasks : allTasks.filter((t: any) => t.groupFolder === groupFolder);

    if (tasks.length === 0) return 'No scheduled tasks found.';

    const formatted = tasks
      .map((t: any) => `- [${t.id}] ${t.prompt.slice(0, 50)}... (${t.schedule_type}: ${t.schedule_value}) - ${t.status}`)
      .join('\n');

    return `Scheduled tasks:\n${formatted}`;
  },
};

export const pauseTask: AgentTool<{ task_id: string }, string> = {
  name: 'pause_task',
  description: 'Pause a scheduled task.',
  parameters: {
    type: 'object',
    properties: { task_id: { type: 'string' } },
    required: ['task_id'],
  },
  execute: async (args) => {
    const data = {
      type: 'pause_task',
      taskId: args.task_id,
      timestamp: new Date().toISOString(),
    };
    writeIpcFile(TASKS_DIR, data);
    return `Task ${args.task_id} pause requested.`;
  },
};

// ... resumeTask, cancelTask, registerGroup would be implemented similarly

export const sharedTools: AgentTool<any, any>[] = [
  sendMessage,
  scheduleTask,
  listTasks,
  pauseTask,
];
