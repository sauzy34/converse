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
import { useCallback, useState } from "react";
import ollama, { Tool, type Message as OMessage } from "ollama/browser";
import { truncateHistory } from "@/utils/truncateHistory";
import { getGithubReposUrl } from "@/utils/getGithubReposUrl";
import { useMutation } from "@tanstack/react-query";
// import z from "zod";
import { type SystemModelMessage } from "ai";
import { Loader } from "@/components/ai/loader";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";

export interface ExtendedMessage extends OMessage {
  id: string;
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

type AddMessageVariables = { sessionId: string; role: string; content: string };

const systemPrompt: SystemModelMessage = {
  role: "system",
  content:
    "You are a helpful assistant." +
    "You will find the github public repositories of the given username.",
};

const addMessage = async ({
  sessionId,
  role,
  content,
}: AddMessageVariables) => {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, role, content }),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
};

export default function Home() {
  const [isDone, setIsDone] = useState(false);
  const [inputStatus, setInputStatus] =
    useState<PromptInputSubmitProps["status"]>("ready");
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const { mutate } = useMutation({
    mutationFn: addMessage,
  });

  const handleNewChat = useCallback(() => {
    setSessionId(crypto.randomUUID());
    setMessages([]);
  }, []);

  const handleSubmit = async (message: PromptInputMessage) => {
    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    mutate({
      sessionId,
      role: "user",
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
      setIsDone(true);
      const response = await ollama.chat({
        model: "qwen3",
        messages: [systemPrompt, ...filteredMessages],
        stream: true,
        options: {
          temperature: 0.8,
          num_predict: 2000,
        },
        tools: [githubTool],
      });

      let fullContent = "";
      const toolCalls: NonNullable<OMessage["tool_calls"]> = [];

      for await (const chunk of response) {
        if (chunk.message.content) {
          fullContent += chunk.message.content;
          setIsDone(false);
          setMessages((prev) =>
            prev.map((currentMessage) =>
              currentMessage.id === assistantId
                ? { ...currentMessage, content: fullContent }
                : currentMessage,
            ),
          );
        }
        if (chunk.message.tool_calls?.length) {
          toolCalls.push(...chunk.message.tool_calls);
        }
      }

      if (toolCalls.length === 0) {
        setIsDone(false);
        mutate({ sessionId, role: "assistant", content: fullContent });
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
          try {
            const result = await impl(
              args as Parameters<typeof getGithubReposUrl>[0],
            );
            toolResult = JSON.stringify(result);
          } catch (err) {
            toolResult =
              err instanceof Error ? err.message : "Tool execution failed";
          }
        }
        setIsDone(false);
        setMessages((prev) =>
          prev.map((currentMessage) =>
            currentMessage.id === assistantId
              ? { ...currentMessage, content: toolResult, role: "tool" }
              : currentMessage,
          ),
        );
        mutate({ sessionId, role: "tool", content: toolResult });
      }
    } catch (err) {
      console.error({ err });
    } finally {
      setInputStatus("ready");
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden px-4">
      <div className="flex justify-end p-2">
        <Button variant="outline" size="sm" onClick={handleNewChat}>
          <PlusIcon className="size-4" />
          New Chat
        </Button>
      </div>
      <Conversation className="relative size-full p-4">
        <ConversationContent>
          {messages.map((msg) => (
            <Message
              from={msg?.role as "user" | "assistant" | "system"}
              key={msg?.id}
            >
              <MessageContent>{msg.content}</MessageContent>
            </Message>
          ))}
          {isDone && <Loader size={16} />}
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
