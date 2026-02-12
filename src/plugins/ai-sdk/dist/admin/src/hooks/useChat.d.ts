export interface ToolCall {
    toolCallId: string;
    toolName: string;
    input: unknown;
    output?: unknown;
}
export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    toolCalls?: ToolCall[];
}
export declare function useChat(): {
    messages: Message[];
    sendMessage: (text: string) => Promise<void>;
    clearMessages: () => void;
    isLoading: boolean;
    error: string | null;
};
