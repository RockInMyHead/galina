import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";

const VoiceSimple = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <div className="flex-1 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Голосовой чат</h1>
        <Button>
          <Mic className="w-4 h-4 mr-2" />
          Тест микрофона
        </Button>
      </div>
    </div>
  );
};

export default VoiceSimple;
