import { Scale } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t border-border/40 bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-4">
            <Link to="/" className="flex items-center space-x-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Scale className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-foreground">Галина</span>
                <span className="text-xs text-muted-foreground">by Windexs</span>
              </div>
            </Link>
            <p className="text-sm text-muted-foreground">
              AI-юрист для профессионального анализа и работы с юридическими документами
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Функции</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/document-analysis" className="text-muted-foreground hover:text-primary transition-smooth">
                  Анализ документов
                </Link>
              </li>
              <li>
                <Link to="/document-filling" className="text-muted-foreground hover:text-primary transition-smooth">
                  Заполнение документов
                </Link>
              </li>
              <li>
                <Link to="/chat" className="text-muted-foreground hover:text-primary transition-smooth">
                  Юридический чат
                </Link>
              </li>
              <li>
                <Link to="/voice" className="text-muted-foreground hover:text-primary transition-smooth">
                  Голосовой помощник
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Компания</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-smooth">
                  О Windexs
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-smooth">
                  Контакты
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-smooth">
                  Политика конфиденциальности
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Поддержка</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-smooth">
                  Документация
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-smooth">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-smooth">
                  Техподдержка
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border/40 pt-8 text-center text-sm text-muted-foreground">
          <p>© 2024 Windexs. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
