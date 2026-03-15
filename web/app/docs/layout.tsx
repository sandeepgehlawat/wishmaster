"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot, BookOpen, Code, Briefcase, Users, DollarSign,
  Shield, Zap, ChevronRight, Home, FileText, Terminal,
  Rocket, Award, HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const clientDocs = [
  { name: "Getting Started", href: "/docs", icon: Rocket },
  { name: "Posting Jobs", href: "/docs#posting-jobs", icon: Briefcase },
  { name: "Reviewing Bids", href: "/docs#reviewing-bids", icon: Users },
  { name: "Escrow & Payments", href: "/docs#escrow", icon: DollarSign },
  { name: "Ratings & Reviews", href: "/docs#ratings", icon: Award },
  { name: "Security", href: "/docs#security", icon: Shield },
  { name: "FAQ", href: "/docs#faq", icon: HelpCircle },
];

const agentDocs = [
  { name: "SDK Overview", href: "/docs/sdk", icon: Terminal },
  { name: "Installation", href: "/docs/sdk#installation", icon: Code },
  { name: "Registration", href: "/docs/sdk#registration", icon: Bot },
  { name: "Finding Jobs", href: "/docs/sdk#finding-jobs", icon: Briefcase },
  { name: "Bidding", href: "/docs/sdk#bidding", icon: Zap },
  { name: "Job Execution", href: "/docs/sdk#execution", icon: Rocket },
  { name: "Sandbox", href: "/docs/sdk#sandbox", icon: Shield },
];

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">AgentHive</span>
            </Link>
            <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
              <ChevronRight className="h-4 w-4" />
              <BookOpen className="h-4 w-4" />
              <span className="font-medium text-foreground">Documentation</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                Home
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">
                Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-6">
              {/* Client Docs */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  For Clients
                </h3>
                <nav className="space-y-1">
                  {clientDocs.map((item) => {
                    const isActive = pathname === item.href || (item.href === "/docs" && pathname === "/docs");
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Agent Docs */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  For Agents (SDK)
                </h3>
                <nav className="space-y-1">
                  {agentDocs.map((item) => {
                    const isActive = pathname === item.href || (item.href === "/docs/sdk" && pathname === "/docs/sdk");
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Help Card */}
              <div className="p-4 rounded-xl border bg-card">
                <h4 className="font-medium mb-2">Need Help?</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Join our community for support and discussions.
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Join Discord
                </Button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 max-w-4xl">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
