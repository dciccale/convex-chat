"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useState } from "react";

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const [client] = useState(() => (url ? new ConvexReactClient(url) : null));

  if (!client) {
    return (
      <main className="setup-shell">
        <div className="setup-card">
          <span className="eyebrow">One setup step remains</span>
          <h1>Connect the Convex development deployment</h1>
          <p>
            Run <code>pnpm convex:dev</code> at the workspace root. Convex will
            create <code>apps/web/.env.local</code> with the client URL.
          </p>
        </div>
      </main>
    );
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
