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

async function getGithubReposUrl({ username }: { username: string }) {
  console.log({ username });
  const res = await fetch(
    `https://api.github.com/users/${username}/repos?per_page=100&page=1`,
  );
  const repos = await res.json();
  console.log({ urls: repos.map((r: any) => r.html_url) });
  return repos.map((r: any) => r.html_url);
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
} satisfies Tool;

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
} satisfies Tool;

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
  addTwoNumbers,
  subTwoNumbers,
  getGithubReposUrl,
} as const;

export default function Home() {
  const [inputStatus, setInputStatus] =
    useState<PromptInputSubmitProps["status"]>("ready");
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [toolMessages, setToolMessages] = useState<ExtendedMessage[]>([]);

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
        tools: [addTool, subTool, githubTool],
      });

      const toolCalls = initialResponse.message.tool_calls ?? [];
      console.log({ toolCalls });
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
        console.log({ tool });
        const fnName = tool.function.name;
        const args = tool.function.arguments;
        const impl = TOOL_REGISTRY[fnName];
        console.log({ fnName, args });

        let toolResult = "Tool not implemented";

        if (impl) {
          const result = await impl(args);
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
          <PromptInputSubmit status={inputStatus} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
