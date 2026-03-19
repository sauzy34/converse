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
import { ollama } from "ai-sdk-ollama";
import { generateText } from "ai";

export default function Home() {
  const [inputStatus, setInputStatus] =
    useState<PromptInputSubmitProps["status"]>("ready");
  const [messages, setMessages] = useState<
    { from: "user" | "assistant"; id: string; text: string }[]
  >([]);

  const handleSubmit = async (message: PromptInputMessage) => {
    setInputStatus("submitted");
    setMessages((prev) => [
      ...prev,
      {
        from: "user",
        id: Math.random().toString(),
        text: message.text,
      },
    ]);
    const { response, text } = await generateText({
      model: ollama("phi3"),
      prompt: message.text,
      temperature: 0.8,
      system: "You are a helpful assistant",
    });
    console.log({ response });

    setMessages((prev) => [
      ...prev,
      {
        from: "assistant",
        id: response.id,
        text,
      },
    ]);
    setInputStatus("ready");
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-4 px-8 bg-white dark:bg-black sm:items-start">
        <Conversation className="relative size-full p-4">
          <ConversationContent>
            {messages.map((msg) => (
              <Message from={msg?.from} key={msg?.id}>
                <MessageContent>{msg.text}</MessageContent>
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
      </main>
    </div>
  );
}
