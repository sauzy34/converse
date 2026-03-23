"use client";

import Conversation, {
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai/conversation";
import Message, { MessageContent } from "@/components/ai/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputMessage,
  PromptInputSubmit,
  PromptInputSubmitProps,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai/prompt-input";
import { useState } from "react";
import ollama, { type Message as OMessage } from "ollama/browser";
import { truncateHistory } from "@/utils/truncateHistory";

export interface ExtendedMessage extends OMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
}

const MAX_TOKENS = 4000;

function addTwoNumbers(a: number, b: number) {
  return a + b;
}

function subTwoNumbers(a: number, b: number) {
  return a - b;
}

const addTool = {
  type: "function",
  function: {
    name: "addTwoNumbers",
    description: "Add two numbers together",
    parameters: {
      type: "object",
      required: ["a", "b"],
      properties: {
        a: { type: "number", description: "The first number" },
        b: { type: "number", description: "The second number" },
      },
    },
  },
};

const subTool = {
  type: "function",
  function: {
    name: "subTwoNumbers",
    description: "Subtract two numbers together",
    parameters: {
      type: "object",
      required: ["a", "b"],
      properties: {
        a: { type: "number", description: "The first number" },
        b: { type: "number", description: "The second number" },
      },
    },
  },
};

const TOOL_REGISTRY = {
  addTwoNumbers,
  subTwoNumbers,
} as const;

export default function Home() {
  const [inputStatus, setInputStatus] =
    useState<PromptInputSubmitProps["status"]>("ready");
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);

  const handleSubmit = async (message: PromptInputMessage) => {
    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();

    setInputStatus("streaming");

    const userMessage: ExtendedMessage = {
      role: "user",
      id: userId,
      content: message.text,
    };
    const assistantMessage: ExtendedMessage = {
      role: "assistant",
      id: assistantId,
      content: "",
    };

    const nextMessages = [...messages, userMessage];
    const filteredMessages = truncateHistory(nextMessages, MAX_TOKENS);

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const initialResponse = await ollama.chat({
        model: "qwen3",
        messages: [
          { role: "system", content: "You are a helpful assistant" },
          ...filteredMessages,
        ],
        stream: false,
        options: {
          temperature: 0.8,
          num_predict: 2000,
        },
        tools: [addTool, subTool],
      });

      const toolCalls = initialResponse.message.tool_calls ?? [];

      if (toolCalls.length === 0) {
        const assistantContent = initialResponse.message.content ?? "";
        setMessages((prev) =>
          prev.map((currentMessage) =>
            currentMessage.id === assistantId
              ? { ...currentMessage, content: assistantContent }
              : currentMessage,
          ),
        );
        return;
      }

      const toolMessages = toolCalls.reduce<ExtendedMessage[]>(
        (accumulator, toolCall) => {
          const toolName = toolCall.function.name as keyof typeof TOOL_REGISTRY;
          const tool = TOOL_REGISTRY[toolName];
          if (!tool) {
            return accumulator;
          }

          const result = tool(
            toolCall.function.arguments.a,
            toolCall.function.arguments.b,
          );

          accumulator.push({
            role: "tool",
            id: crypto.randomUUID(),
            tool_name: toolName,
            content: String(result),
          });

          return accumulator;
        },
        [],
      );

      if (toolMessages.length === 0) {
        setMessages((prev) =>
          prev.map((currentMessage) =>
            currentMessage.id === assistantId
              ? {
                  ...currentMessage,
                  content: "I tried to call a tool, but none of the requested tools are available.",
                }
              : currentMessage,
          ),
        );
        return;
      }

      setMessages((prev) => [...prev, ...toolMessages]);

      const finalResponse = await ollama.chat({
        model: "qwen3",
        messages: [
          { role: "system", content: "You are a helpful assistant" },
          ...filteredMessages,
          initialResponse.message,
          ...toolMessages.map(({ role, content, tool_name }) => ({
            role,
            content,
            tool_name,
          })),
        ],
        stream: false,
        options: {
          temperature: 0.8,
          num_predict: 2000,
        },
      });

      const finalContent = finalResponse.message.content ?? "";
      setMessages((prev) =>
        prev.map((currentMessage) =>
          currentMessage.id === assistantId
            ? { ...currentMessage, content: finalContent }
            : currentMessage,
        ),
      );
    } catch (err) {
      console.error({ err });
    } finally {
      setInputStatus("ready");
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden px-4">
      <Conversation className="relative size-full p-4">
        <ConversationContent>
          {messages.map((msg) => (
            <Message from={msg?.role} key={msg?.id}>
              <MessageContent>{msg.content}</MessageContent>
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputAttachments>
          {(attachment) => <PromptInputAttachment data={attachment} />}
        </PromptInputAttachments>
        <PromptInputBody>
          <PromptInputTextarea />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
          </PromptInputTools>
          <PromptInputSubmit status={inputStatus} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
