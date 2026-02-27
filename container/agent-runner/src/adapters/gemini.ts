import { GoogleGenerativeAI, ChatSession, GenerativeModel } from '@google/generative-ai';
import { AgentProvider, ContainerInput, ContainerOutput } from '../types.js';
import { sharedTools } from '../tools/definitions.js';

export class GeminiAdapter implements AgentProvider {
  name = 'gemini';
  private genAI!: GoogleGenerativeAI;
  private model!: GenerativeModel;
  private chat!: ChatSession;
  private input!: ContainerInput;

  async initialize(input: ContainerInput, sdkEnv: Record<string, string | undefined>): Promise<void> {
    this.input = input;
    const apiKey = sdkEnv.GOOGLE_GENERATIVE_AI_API_KEY || sdkEnv.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Google Generative AI API key not found (GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY)');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);

    const functionDeclarations = sharedTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    this.model = this.genAI.getGenerativeModel({
      model: this.input.modelVersion || 'gemini-2.0-flash',
      tools: [{ functionDeclarations }],
    });

    // In a production app, we'd persist the chat history. 
    // For this refactor, we start a fresh chat or could resume if history was provided.
    this.chat = this.model.startChat({
      history: [], // Logic to map NanoClaw history to Gemini format could go here
    });
  }

  async query(
    prompt: string | AsyncIterable<any>,
    onOutput: (output: ContainerOutput) => Promise<void>
  ): Promise<{ newSessionId?: string; lastAssistantUuid?: string; closedDuringQuery: boolean }> {
    
    const textPrompt = typeof prompt === 'string' ? prompt : 'Async message stream not yet fully supported in Gemini adapter.';

    let result = await this.chat.sendMessage(textPrompt);
    let response = result.response;

    // Handle function calls in a loop
    while (response.functionCalls() && response.functionCalls()!.length > 0) {
      const functionCalls = response.functionCalls()!;
      const functionResponses = [];

      for (const call of functionCalls) {
        const tool = sharedTools.find(t => t.name === call.name);
        if (tool) {
          try {
            const toolResult = await tool.execute(call.args);
            functionResponses.push({
              functionResponse: {
                name: call.name,
                response: { result: toolResult },
              },
            });
          } catch (err) {
            functionResponses.push({
              functionResponse: {
                name: call.name,
                response: { error: String(err) },
              },
            });
          }
        }
      }

      if (functionResponses.length > 0) {
        result = await this.chat.sendMessage(functionResponses);
        response = result.response;
      } else {
        break;
      }
    }

    const finalResultText = response.text();
    await onOutput({
      status: 'success',
      result: finalResultText,
    });

    return { closedDuringQuery: false };
  }
}
