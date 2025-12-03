import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { X, Trash2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'speech' | 'recognition' | 'llm' | 'tts' | 'error' | 'info';
  message: string;
  details?: any;
}

interface LogsPanelProps {
  logs: LogEntry[];
  isVisible: boolean;
  onClose: () => void;
  onClear: () => void;
}

const LogsPanel: React.FC<LogsPanelProps> = ({ logs, isVisible, onClose, onClear }) => {
  const getLogTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'speech': return 'bg-blue-500';
      case 'recognition': return 'bg-green-500';
      case 'llm': return 'bg-purple-500';
      case 'tts': return 'bg-orange-500';
      case 'error': return 'bg-red-500';
      case 'info': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="absolute top-4 right-4 bottom-4 w-96 bg-background border border-border rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <h3 className="font-semibold">Логи разговора</h3>
            <Badge variant="secondary" className="text-xs">
              {logs.length}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Logs Content */}
        <ScrollArea className="flex-1 p-4">
          {logs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Логи разговора будут отображаться здесь</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    "p-3 rounded-lg border text-sm",
                    log.type === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' : 'bg-card'
                  )}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge
                      className={cn("text-white text-xs", getLogTypeColor(log.type))}
                    >
                      {log.type === 'speech' && '🎤'}
                      {log.type === 'recognition' && '👂'}
                      {log.type === 'llm' && '🤖'}
                      {log.type === 'tts' && '🔊'}
                      {log.type === 'error' && '❌'}
                      {log.type === 'info' && 'ℹ️'}
                      {log.type.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(log.timestamp)}
                    </span>
                  </div>

                  <p className="text-foreground leading-relaxed">
                    {log.message}
                  </p>

                  {log.details && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        Подробности
                      </summary>
                      <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                        {typeof log.details === 'string'
                          ? log.details
                          : JSON.stringify(log.details, null, 2)
                        }
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default LogsPanel;
