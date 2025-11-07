import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSearch, FileEdit, Upload, CheckCircle, Clock, Shield } from "lucide-react";
import { Link } from "react-router-dom";

const Documents = () => {
  const documentServices = [
    {
      icon: FileSearch,
      title: "Анализ документов",
      description: "Загрузите юридический документ для автоматического анализа ключевых моментов, выявления рисков и получения рекомендаций",
      href: "/document-analysis",
      features: ["Выявление рисков", "Ключевые моменты", "Рекомендации"],
      color: "bg-blue-500/10 text-blue-600",
    },
    {
      icon: FileEdit,
      title: "Заполнение документов",
      description: "Автоматическое заполнение юридических форм и шаблонов с учетом всех требований законодательства",
      href: "/document-filling",
      features: ["Автозаполнение", "Шаблоны документов", "Валидация данных"],
      color: "bg-green-500/10 text-green-600",
    },
  ];

  const benefits = [
    {
      icon: Upload,
      title: "Быстрая загрузка",
      description: "Поддержка различных форматов файлов и мгновенная обработка",
    },
    {
      icon: CheckCircle,
      title: "Высокая точность",
      description: "AI-технологии обеспечивают точный анализ и заполнение",
    },
    {
      icon: Clock,
      title: "Экономия времени",
      description: "Автоматизация рутинных задач по работе с документами",
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
                <FileSearch className="h-8 w-8" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              Работа с документами
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Профессиональные инструменты для анализа и заполнения юридических документов с использованием ИИ.
            </p>
          </div>

          {/* Document Services */}
          <div className="max-w-5xl mx-auto mb-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {documentServices.map((service, index) => (
                <Card key={index} className="border-border/50 shadow-elegant hover:shadow-glow transition-smooth">
                  <CardHeader className="text-center pb-4">
                    <div className="flex justify-center mb-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${service.color}`}>
                        <service.icon className="h-6 w-6" />
                      </div>
                    </div>
                    <CardTitle className="text-2xl">{service.title}</CardTitle>
                    <CardDescription className="text-base">{service.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <ul className="space-y-2">
                        {service.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button asChild className="w-full shadow-elegant">
                        <Link to={service.href}>
                          Начать работу
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Benefits Section */}
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Преимущества работы с документами
              </h2>
              <p className="text-muted-foreground">
                Современные инструменты для эффективной юридической работы
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

          {/* CTA Section */}
          <div className="max-w-4xl mx-auto mt-16">
            <Card className="border-border/50 shadow-elegant bg-gradient-to-r from-primary/5 to-primary/10">
              <CardContent className="p-8 text-center">
                <div className="flex justify-center mb-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Shield className="h-8 w-8" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-4">Безопасность и конфиденциальность</h3>
                <p className="text-muted-foreground mb-6">
                  Все документы обрабатываются с соблюдением строгих стандартов безопасности.
                  Ваши данные защищены и не передаются третьим лицам.
                </p>
                <Button size="lg" asChild className="shadow-elegant">
                  <Link to="/dashboard">
                    Начать работу с документами
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Documents;
