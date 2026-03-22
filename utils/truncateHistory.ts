import { ExtendedMessage } from "@/app/page";
import { get_encoding } from "tiktoken";

function truncateHistory(messages: ExtendedMessage[], maxTokens: number) {
  const encoder = get_encoding("cl100k_base");

  // Count total tokens (system + history + new)
  let totalTokens = 0;
  for (const msg of messages) {
    totalTokens += encoder.encode(msg.content ?? "").length + 4; // ~3-4 overhead per msg
  }

  // Drop oldest until under limit
  while (totalTokens > maxTokens && messages.length > 1) {
    // Keep at least system/user
    const removed = messages.shift();
    totalTokens -= encoder.encode(removed?.content ?? "").length + 4;
  }

  return messages;
}

export { truncateHistory };
