import Header from "@/components/Header";
import FeatureCard from "@/components/FeatureCard";
import { FileSearch, FileEdit, MessageSquare, Mic, Wallet, Plus, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useBalance } from "@/hooks/useBalance";
import { BALANCE_CONFIG } from "@/config/constants";

const Dashboard = () => {
  const balance = useBalance();
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isTopUpDialogOpen, setIsTopUpDialogOpen] = useState(false);

  const features = [
    {
      icon: FileSearch,
      title: "Анализ документов",
      description: "Загрузите документ для подробного юридического анализа",
      href: "/document-analysis",
    },
    {
      icon: FileEdit,
      title: "Заполнение документов",
      description: "Автоматизируйте заполнение юридических форм",
      href: "/document-filling",
    },
    {
      icon: MessageSquare,
      title: "Юридический чат",
      description: "Задайте вопрос юристу-AI в текстовом формате",
      href: "/chat",
    },
    {
      icon: Mic,
      title: "Голосовой помощник",
      description: "Общайтесь с Галиной голосом для решения задач",
      href: "/voice",
    },
  ];

  // Функция пополнения баланса
  const handleTopUp = () => {
    const amount = parseFloat(topUpAmount);
    if (amount > 0) {
      balance.addToBalance(amount);
      setTopUpAmount('');
      setIsTopUpDialogOpen(false);

      // Имитация успешного платежа
      alert(`Баланс успешно пополнен на ${amount} ₽!`);
    }
  };

  // Форматирование баланса
  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(amount);
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <Header />
      
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12">
          {/* Welcome Section */}
          <div className="mb-12">
            <Card className="gradient-card border-border/50 shadow-elegant">
              <CardContent className="p-8">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="space-y-2">
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                      Добро пожаловать в личный кабинет
                    </h1>
                    <p className="text-lg text-muted-foreground">
                      Выберите нужный инструмент для работы с Галиной
                    </p>
                  </div>

                  {/* Wallet Section */}
                  <Card className="border-border/50 bg-background/50 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Wallet className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Баланс</p>
                          <p className="text-2xl font-bold text-foreground">
                            {formatBalance(balance.balance)}
                          </p>
                        </div>
                        <Dialog open={isTopUpDialogOpen} onOpenChange={setIsTopUpDialogOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" className="ml-2">
                              <Plus className="h-4 w-4 mr-1" />
                              Пополнить
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Пополнение баланса</DialogTitle>
                              <DialogDescription>
                                Введите сумму для пополнения баланса кошелька
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="amount">Сумма пополнения (₽)</Label>
                                <Input
                                  id="amount"
                                  type="number"
                                  placeholder="1000"
                                  value={topUpAmount}
                                  onChange={(e) => setTopUpAmount(e.target.value)}
                                  min="1"
                                  step="0.01"
                                />
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CreditCard className="h-4 w-4" />
                                <span>Оплата производится через банковскую карту</span>
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  onClick={() => setIsTopUpDialogOpen(false)}
                                >
                                  Отмена
                                </Button>
                                <Button
                                  onClick={handleTopUp}
                                  disabled={!topUpAmount || parseFloat(topUpAmount) <= 0}
                                >
                                  Пополнить
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Main Features */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6">
                Инструменты Галины
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {features.map((feature, index) => (
                  <FeatureCard key={index} {...feature} />
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
