import Header from "@/components/Header";
import FeatureCard from "@/components/FeatureCard";
import { FileSearch, FileEdit, MessageSquare, Mic, Wallet, Plus, CreditCard, User, Calendar, FileText, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useBalance } from "@/hooks/useBalance";
import { useAuth } from "@/contexts/AuthContext";
import { BALANCE_CONFIG, API_CONFIG } from "@/config/constants";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  balance?: { amount: number };
  messages?: Array<{ id: string; timestamp: string }>;
  files?: Array<{ id: string; createdAt: string }>;
}

const Dashboard = () => {
  const balance = useBalance();
  const { user: authUser } = useAuth();
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isTopUpDialogOpen, setIsTopUpDialogOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // Загрузка профиля пользователя
  const loadUserProfile = async () => {
    try {
      setIsProfileLoading(true);
      const token = localStorage.getItem('galina-token');
      if (!token) {
        console.warn('No auth token found');
        return;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/user/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setUserProfile(data.user);
        }
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    } finally {
      setIsProfileLoading(false);
    }
  };

  // Загружаем профиль при монтировании компонента
  useEffect(() => {
    loadUserProfile();
  }, []);

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
                      {userProfile?.name ? `Добро пожаловать, ${userProfile.name}!` : 'Добро пожаловать в личный кабинет'}
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

          {/* User Profile Section */}
          <div className="mb-12">
            <Card className="border-border/50 shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Информация о пользователе
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isProfileLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-2 text-muted-foreground">Загрузка профиля...</span>
                  </div>
                ) : userProfile ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Основная информация */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm text-muted-foreground">Имя</span>
                      </div>
                      <p className="text-lg font-semibold">{userProfile.name}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm text-muted-foreground">Email</span>
                      </div>
                      <p className="text-lg font-semibold break-all">{userProfile.email}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm text-muted-foreground">Дата регистрации</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {new Date(userProfile.createdAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>

                    {/* Статистика */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm text-muted-foreground">Всего сообщений</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {userProfile.messages?.length || 0}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm text-muted-foreground">Файлов загружено</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {userProfile.files?.length || 0}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm text-muted-foreground">Текущий баланс</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {formatBalance(userProfile.balance?.amount || balance.balance)} ₽
                      </p>
                    </div>

                    {/* ID пользователя */}
                    <div className="space-y-3 col-span-full">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm text-muted-foreground">ID пользователя</span>
                      </div>
                      <p className="text-xs font-mono bg-muted px-3 py-2 rounded break-all">
                        {userProfile.id}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Не удалось загрузить информацию о пользователе</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={loadUserProfile}
                    >
                      Попробовать снова
                    </Button>
                  </div>
                )}
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
