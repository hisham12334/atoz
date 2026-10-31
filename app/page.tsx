import { requireChatGPTUser } from "./chatgpt-auth";
import Ledger from "./ledger";
export const dynamic = "force-dynamic";
export default async function Home() {
  await requireChatGPTUser("/");
  return <Ledger />;
}
