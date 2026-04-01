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
import ollama, { Tool, type Message as OMessage } from "ollama/browser";
import { truncateHistory } from "@/utils/truncateHistory";
import { getGithubReposUrl } from "@/utils/getGithubReposUrl";
import { useMutation } from "@tanstack/react-query";

export interface ExtendedMessage extends OMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
}

const MAX_TOKENS = 4000;

const githubTool = {
  type: "function",
  function: {
    name: "getGithubReposUrl",
    description: "Fetch user's all public github urls",
    parameters: {
      type: "object",
      required: ["username"],
      properties: {
        username: { type: "string", description: "Github username" },
      },
    },
  },
} satisfies Tool;

const TOOL_REGISTRY = {
  getGithubReposUrl,
} as const;

type AddMessageVariables = { sessionId: string; content: string };

const addMessage = async ({ sessionId, content }: AddMessageVariables) => {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, role: "user", content }),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
};

export default function Home() {
  const [inputStatus, setInputStatus] =
    useState<PromptInputSubmitProps["status"]>("ready");
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const { mutate } = useMutation({
    mutationFn: addMessage,
  });

  const handleSubmit = async (message: PromptInputMessage) => {
    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    mutate({
      sessionId: crypto.randomUUID(),
      content: message.text,
    });
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
        tools: [githubTool],
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

      for (const tool of toolCalls) {
        const fnName = tool.function.name;
        const args = tool.function.arguments;
        const impl =
          fnName in TOOL_REGISTRY
            ? TOOL_REGISTRY[fnName as keyof typeof TOOL_REGISTRY]
            : undefined;

        let toolResult = "Tool not implemented";

        if (impl) {
          const result = await impl(
            args as Parameters<typeof getGithubReposUrl>[0],
          );
          toolResult = JSON.stringify(result);
        }
        setMessages((prev) =>
          prev.map((currentMessage) =>
            currentMessage.id === assistantId
              ? { ...currentMessage, content: toolResult, role: "tool" }
              : currentMessage,
          ),
        );
      }
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
          <PromptInputSubmit
            status={inputStatus}
            disabled={inputStatus === "streaming"}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
