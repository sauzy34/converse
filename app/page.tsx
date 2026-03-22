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

interface ExtendedMessage extends OMessage {
  id: string;
  role: "user" | "assistant" | "system";
}

export default function Home() {
  const [inputStatus, setInputStatus] =
    useState<PromptInputSubmitProps["status"]>("ready");
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);

  const handleSubmit = async (message: PromptInputMessage) => {
    const userId = crypto.randomUUID();

    setInputStatus("streaming");

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        id: userId,
        content: message.text,
      },
    ]);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { role: "assistant", id: assistantId, content: "" },
    ]);

    try {
      const response = await ollama.chat({
        model: "phi3",
        messages: [
          { role: "system", content: "You are a helpful assistant" },
          { role: "user", content: message.text },
        ],
        stream: true,
        options: {
          temperature: 0.8,
        },
      });

      for await (const part of response) {
        const delta = part.message?.content ?? "";

        if (!delta) continue;
        setMessages((prev) =>
          prev.map((m) => {
            return m.id === assistantId
              ? { ...m, content: m.content + delta }
              : m;
          }),
        );
      }
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
