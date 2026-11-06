import { createContext, useContext } from "react";

// Open/closed state of the right-hand client chat panel on the review queue.
// Lives in the app shell so the page content can make room for (or reclaim) the panel's space.
export const ChatDockContext = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: true,
  setOpen: () => {},
});

export const useChatDock = () => useContext(ChatDockContext);