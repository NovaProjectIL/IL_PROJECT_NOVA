import ChatBox from "../components/ChatBox";
import { ChatProvider } from "../context/ChatContext";

export default function Page() {
  return (
    <ChatProvider>
      <ChatBox />
    </ChatProvider>
  );
}
