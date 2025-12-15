import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import FeatureCard from "@/components/FeatureCard";
import { FileSearch, FileEdit, MessageSquare, Mic, Shield, Zap, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-galina.png";
import heroOverlay from "@/assets/hero-overlay.png";

const Index = () => {
  const features = [
    {
      icon: FileSearch,
      title: "Анализ документов",
      description: "Быстрый и точный анализ юридических документов с выявлением ключевых моментов и рисков",
      href: "/document-analysis",
    },
    {
      icon: FileEdit,
      title: "Заполнение документов",
      description: "Автоматическое заполнение юридических форм и документов с учетом всех требований",
      href: "/document-filling",
    },
    {
      icon: MessageSquare,
      title: "Юридический чат",
      description: "Получайте консультации по юридическим вопросам в режиме реального времени",
      href: "/chat",
    },
    {
      icon: Mic,
      title: "Голосовой помощник",
      description: "Общайтесь с Галиной голосом для быстрого решения юридических вопросов",
      href: "/voice",
    },
  ];

  const benefits = [
    {
      icon: Shield,
      title: "Надежность",
      description: "Работаем на основе актуального законодательства РФ",
    },
    {
      icon: Zap,
      title: "Скорость",
      description: "Мгновенная обработка документов и ответы на вопросы",
    },
    {
      icon: CheckCircle2,
      title: "Точность",
      description: "AI-технологии обеспечивают высокую точность анализа",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-hero">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10"></div>
        <div className="container mx-auto px-4 py-24 md:py-32 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground leading-tight">
                  AI-Юрист Галина
                </h1>
                <p className="text-xl md:text-2xl text-primary-foreground/90">
                  Ваш персональный юридический помощник на базе искусственного интеллекта
                </p>
              </div>
              <p className="text-lg text-primary-foreground/80 leading-relaxed">
                Галина поможет анализировать документы, заполнять формы, консультировать по юридическим вопросам и многое другое. Профессиональная юридическая помощь доступна 24/7.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="shadow-glow hover:shadow-elegant transition-smooth">
                  <Link to="/dashboard">Начать работу</Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="bg-background/10 backdrop-blur border-primary-foreground/20 text-primary-foreground hover:bg-background/20">
                  <Link to="/chat">Попробовать чат</Link>
                </Button>
              </div>
            </div>
            <div className="relative lg:block">
              <div className="relative rounded-2xl overflow-hidden shadow-glow">
                <img
                  src={heroImage}
                  alt="AI-Юрист Галина"
                  className="w-full h-auto object-cover"
                />
                <img
                  src={heroOverlay}
                  alt="Галина с документами"
                  className="absolute inset-0 h-full w-full object-cover opacity-50"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Возможности Галины
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Полный спектр юридических услуг с использованием передовых AI-технологий
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Почему выбирают Галину
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Современные технологии для профессиональной юридической поддержки
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <benefit.icon className="h-8 w-8" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-foreground">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10"></div>
        <div className="container mx-auto px-4 text-center relative">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground">
              Готовы начать работу с Галиной?
            </h2>
            <p className="text-xl text-primary-foreground/90">
              Присоединяйтесь к тысячам пользователей, которые уже упростили свою юридическую работу
            </p>
            <Button size="lg" asChild className="shadow-glow">
              <Link to="/dashboard">Начать бесплатно</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
