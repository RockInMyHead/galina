import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, MessageSquare, FileText, User, Mic } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Navigation = () => {
  const { user: _user } = useAuth();
  const location = useLocation();

  const navItems = [
    { to: "/", label: "Главная", icon: Home },
    { to: "/chat", label: "Чат", icon: MessageSquare },
    { to: "/voice", label: "Голос", icon: Mic },
    { to: "/documents", label: "Документы", icon: FileText },
    { to: "/dashboard", label: "Профиль", icon: User },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">Г</span>
            </div>
            <span className="font-semibold text-lg">Галина AI</span>
          </Link>

          {/* Navigation Items */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;

              return (
                <Link key={item.to} to={item.to}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;

              return (
                <Link key={item.to} to={item.to}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="icon"
                    className="w-10 h-10"
                  >
                    <Icon className="w-5 h-5" />
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
