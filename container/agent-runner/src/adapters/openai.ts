import OpenAI from 'openai';
import { AgentProvider, ContainerInput, ContainerOutput } from '../types.js';
import { sharedTools } from '../tools/definitions.js';

export class OpenAIAdapter implements AgentProvider {
  name = 'openai';
  private client!: OpenAI;
  private input!: ContainerInput;

  async initialize(input: ContainerInput, sdkEnv: Record<string, string | undefined>): Promise<void> {
    this.input = input;
    this.client = new OpenAI({
      apiKey: sdkEnv.OPENAI_API_KEY,
    });
  }

  async query(
    prompt: string | AsyncIterable<any>,
    onOutput: (output: ContainerOutput) => Promise<void>
  ): Promise<{ newSessionId?: string; lastAssistantUuid?: string; closedDuringQuery: boolean }> {
    
    // Simplification for the refactor: assuming single prompt for now.
    // OpenAI doesn't natively support AsyncIterable prompt in the same way Claude SDK does.
    const textPrompt = typeof prompt === 'string' ? prompt : 'Async message stream not yet fully supported in OpenAI adapter.';

    const tools = sharedTools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    const response = await this.client.chat.completions.create({
      model: this.input.modelVersion || 'gpt-4o',
      messages: [{ role: 'user', content: textPrompt }],
      tools: tools,
      tool_choice: 'auto',
    });

    const choice = response.choices[0];
    let resultText = choice.message.content || '';

    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        const tool = sharedTools.find(t => t.name === toolCall.function.name);
        if (tool) {
          const args = JSON.parse(toolCall.function.arguments);
          const toolResult = await tool.execute(args);
          resultText += `
[Tool ${tool.name} result: ${toolResult}]`;
        }
      }
    }

    await onOutput({
      status: 'success',
      result: resultText,
    });

    return { closedDuringQuery: false };
  }
}
