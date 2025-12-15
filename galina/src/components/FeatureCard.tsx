import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}

const FeatureCard = ({ icon: Icon, title, description, href }: FeatureCardProps) => {
  return (
    <Link to={href} className="group">
      <Card className="h-full transition-smooth hover:shadow-elegant gradient-card border-border/50">
        <CardContent className="p-6 space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-smooth group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-glow">
            <Icon className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-smooth">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default FeatureCard;
