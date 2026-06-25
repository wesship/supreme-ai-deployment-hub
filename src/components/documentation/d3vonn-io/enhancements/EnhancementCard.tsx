
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface Enhancement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  tag: string;
  status: "Recommended" | "Optional";
}

interface EnhancementCardProps {
  enhancement: Enhancement;
}

const EnhancementCard: React.FC<EnhancementCardProps> = ({ enhancement }) => {
  return (
    <Card className="border border-border/50 hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="p-2 rounded-md bg-primary/10 mb-2">
            {React.createElement(enhancement.icon, { size: 24, className: "text-primary" })}
          </div>
          <Badge variant={enhancement.status === "Recommended" ? "default" : "outline"}>
            {enhancement.status}
          </Badge>
        </div>
        <CardTitle className="text-base">{enhancement.title}</CardTitle>
        <Badge variant="outline" className="w-fit mt-1">{enhancement.tag}</Badge>
      </CardHeader>
      <CardContent>
        <CardDescription>{enhancement.description}</CardDescription>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" className="w-full">Learn More</Button>
      </CardFooter>
    </Card>
  );
};

export default EnhancementCard;
