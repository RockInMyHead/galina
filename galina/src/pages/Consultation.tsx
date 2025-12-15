import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Mic, Users, Clock, Shield } from "lucide-react";
import { Link } from "react-router-dom";

const Consultation = () => {
  const consultationTypes = [
    {
      icon: MessageSquare,
      title: "Юридический чат",
      description: "Задайте любой юридический вопрос в текстовом формате и получите подробную консультацию",
      href: "/chat",
      features: ["Мгновенные ответы", "Подробные объяснения", "Сохранение истории"],
    },
    {
      icon: Mic,
      title: "Голосовой помощник",
      description: "Общайтесь с Галиной голосом - удобно для быстрого получения консультаций",
      href: "/voice",
      features: ["Голосовое взаимодействие", "Быстрые ответы", "Естественная речь"],
    },
  ];

  const benefits = [
    {
      icon: Users,
      title: "Персональный подход",
      description: "Каждая консультация адаптируется под вашу ситуацию",
    },
    {
      icon: Clock,
      title: "Круглосуточная поддержка",
      description: "Получите консультацию в любое удобное время",
    },
    {
      icon: Shield,
      title: "Конфиденциальность",
      description: "Все консультации защищены и конфиденциальны",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-12">
          {/* Header Section */}
          <div className="mb-12 text-center space-y-4">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageSquare className="h-8 w-8" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              Консультация с Галиной
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Выберите удобный способ получения юридической консультации. Галина готова помочь вам с любыми вопросами.
            </p>
          </div>

          {/* Consultation Types */}
          <div className="max-w-5xl mx-auto mb-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {consultationTypes.map((type, index) => (
                <Link
                  key={index}
                  to={type.href}
                  className="group block h-full no-underline"
                >
                  <Card className="h-full border-border/50 shadow-elegant transition-smooth hover:shadow-glow hover:border-primary/50 cursor-pointer">
                    <CardHeader className="text-center pb-4">
                      <div className="flex justify-center mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-smooth group-hover:bg-primary/20">
                          <type.icon className="h-6 w-6" />
                        </div>
                      </div>
                      <CardTitle className="text-2xl">{type.title}</CardTitle>
                      <CardDescription className="text-base">{type.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <ul className="space-y-2">
                          {type.features.map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                              {feature}
                            </li>
                          ))}
                        </ul>
                        <Button asChild className="w-full shadow-elegant">
                          <span>Начать консультацию</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {/* Benefits Section */}
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Преимущества консультаций с Галиной
              </h2>
              <p className="text-muted-foreground">
                Современный подход к юридическим консультациям
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {benefits.map((benefit, index) => (
                <Card key={index} className="border-border/50 text-center">
                  <CardContent className="p-6">
                    <div className="flex justify-center mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <benefit.icon className="h-6 w-6" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Consultation;
