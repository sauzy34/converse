import { ExtendedMessage } from "@/app/page";

// Approximate token count (~4 chars per token for English text)
function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function truncateHistory(messages: ExtendedMessage[], maxTokens: number) {
  // Count total tokens (system + history + new)
  let totalTokens = 0;
  for (const msg of messages) {
    totalTokens += estimateTokens(msg.content ?? "") + 4; // ~3-4 overhead per msg
  }

  // Drop oldest until under limit
  while (totalTokens > maxTokens && messages.length > 1) {
    // Keep at least system/user
    const removed = messages.shift();
    totalTokens -= estimateTokens(removed?.content ?? "") + 4;
  }

  return messages;
}

export { truncateHistory };
