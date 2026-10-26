import { History, ImageIcon, Info, LayoutDashboard, MessagesSquare, PenLine, ScanSearch, Settings, Wand2, type LucideIcon } from "lucide-react";
import type { Page } from "@/state/nav";

export const NAV_ITEMS: Array<{ page: Page; icon: LucideIcon }> = [
  { page: "dashboard", icon: LayoutDashboard },
  { page: "humanizer", icon: Wand2 },
  { page: "chat", icon: MessagesSquare },
  { page: "tools", icon: PenLine },
  { page: "image", icon: ImageIcon },
  { page: "analysis", icon: ScanSearch },
  { page: "history", icon: History },
  { page: "settings", icon: Settings },
  { page: "about", icon: Info },
];
