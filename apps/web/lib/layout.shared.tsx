import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { MessageCircle } from "lucide-react";
import { gitConfig } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="brand-lockup">
          <span className="brand-icon">
            <MessageCircle />
          </span>
          convex-chat
        </span>
      ),
    },
    links: [
      { text: "Documentation", url: "/docs", active: "nested-url" },
      {
        text: "Example",
        url: `https://github.com/${gitConfig.user}/${gitConfig.repo}/tree/main/apps/example`,
        external: true,
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
