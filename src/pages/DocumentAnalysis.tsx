import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileSearch, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';

// Типы для PDF.js
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const DocumentAnalysis = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Загрузка PDF.js через CDN
  useEffect(() => {
    if (!window.pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      };
      document.head.appendChild(script);
    }
  }, []);

  // Функция для извлечения текста из PDF
  const extractTextFromPDF = async (file: File): Promise<string> => {
    console.log('Starting PDF extraction for file:', file.name, 'size:', file.size);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          console.log('FileReader loaded, processing PDF...');
          const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
          console.log('Created Uint8Array, loading PDF document...');

          const pdf = await window.pdfjsLib.getDocument({ data: typedArray }).promise;
          console.log('PDF loaded, pages:', pdf.numPages);

          let fullText = '';

          for (let i = 1; i <= pdf.numPages; i++) {
            console.log(`Processing page ${i}/${pdf.numPages}`);
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ');
            console.log(`Page ${i} text length:`, pageText.length);
            fullText += `${pageText}\n`;
          }

          const finalText = fullText.trim();
          console.log('PDF extraction complete, total text length:', finalText.length);
          resolve(finalText);
        } catch (error) {
          console.error('Error extracting text from PDF:', error);
          reject(new Error('Не удалось извлечь текст из PDF файла'));
        }
      };
      reader.onerror = () => {
        console.error('FileReader error for PDF');
        reject(new Error('Ошибка чтения PDF файла'));
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // Функция для обработки выбора файла
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  // Функция для обработки drag & drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  // Функция валидации и установки файла
  const validateAndSetFile = (file: File) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (file.size > maxSize) {
      alert('Файл слишком большой. Максимальный размер: 10MB');
      return;
    }

    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.txt') && !file.name.endsWith('.doc') && !file.name.endsWith('.docx') && !file.name.endsWith('.pdf')) {
      alert('Неподдерживаемый формат файла. Поддерживаются: PDF, DOC, DOCX, TXT');
      return;
    }

    setSelectedFile(file);
    setAnalysisResult(null);
  };

  // Функция для удаления файла
  const removeFile = () => {
    setSelectedFile(null);
    setAnalysisResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Функция для чтения содержимого файла
  const readFileContent = (file: File): Promise<string> => {
    console.log('Reading file content:', file.name, 'type:', file.type);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        console.log('Reading as text file');
        reader.onload = (e) => {
          const content = e.target?.result as string || '';
          console.log('Text file loaded, length:', content.length);
          resolve(content);
        };
        reader.onerror = () => reject(new Error('Ошибка чтения файла'));
        reader.readAsText(file, 'UTF-8');
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        console.log('Processing as PDF file');
        extractTextFromPDF(file).then(resolve).catch(reject);
      } else if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
        console.log('Processing as DOC file');
        resolve(`[DOC файл: ${file.name}] - Полная обработка DOC файлов будет реализована в следующих версиях.`);
      } else {
        console.log('Unsupported file type');
        resolve(`[Файл: ${file.name}] - Неподдерживаемый формат для анализа.`);
      }
    });
  };

  // Функция для анализа документа через OpenAI
  const analyzeDocumentWithAI = async (fileName: string, fileContent: string): Promise<string> => {
    try {
      const response = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'Вы - опытный юрист в России. Проанализируйте предоставленный документ и дайте подробный юридический анализ на русском языке. Структура ответа должна включать: 1) Основные положения документа, 2) Выявленные риски и проблемы, 3) Рекомендации по улучшению, 4) Заключение. Будьте максимально точны и профессиональны.'
            },
            {
              role: 'user',
              content: `Проанализируйте следующий документ:\n\nНазвание файла: ${fileName}\n\nСодержимое:\n${fileContent}\n\nПожалуйста, проведите полный юридический анализ этого документа.`
            }
          ],
          max_tokens: 2000,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OpenAI API Error:', response.status, errorData);
        throw new Error(`Ошибка OpenAI API: ${response.status}`);
      }

      const data = await response.json();
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Некорректный ответ от OpenAI API');
      }

      return data.choices[0].message.content;
    } catch (error) {
      console.error('Ошибка при анализе через AI:', error);
      throw error;
    }
  };

  // Функция для анализа документа
  const analyzeDocument = async () => {
    if (!selectedFile) return;

    console.log('Starting document analysis for:', selectedFile.name);
    setIsAnalyzing(true);
    try {
      console.log('Reading file content...');
      const fileContent = await readFileContent(selectedFile);
      console.log('File content loaded, length:', fileContent.length);
      console.log('File content preview:', `${fileContent.substring(0, 200)}...`);

      console.log('Sending to AI analysis...');
      const aiAnalysis = await analyzeDocumentWithAI(selectedFile.name, fileContent);
      console.log('AI analysis received, length:', aiAnalysis.length);

      const formattedAnalysis = `**Анализ документа: ${selectedFile.name}**\n\n${aiAnalysis}`;
      console.log('Analysis complete');
      setAnalysisResult(formattedAnalysis);
    } catch (error) {
      console.error('Ошибка анализа:', error);
      const fallbackAnalysis = `**Анализ документа: ${selectedFile.name}**\n\nК сожалению, произошла ошибка при автоматическом анализе документа через ИИ.\n\n**Рекомендации:**\n- Попробуйте загрузить документ еще раз\n- Убедитесь, что файл не поврежден\n- Для сложных документов рекомендуется консультация с юристом\n\n**Примечание:** Автоматический анализ доступен для текстовых файлов. Для PDF и DOC файлов полная обработка может быть ограничена.`;
      setAnalysisResult(fallbackAnalysis);
    } finally {
      setIsAnalyzing(false);
    }
  };

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
              Анализ документов
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Загрузите юридический документ для профессионального анализа. Галина выявит ключевые положения, риски и даст рекомендации.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {/* Upload Section */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-border/50">
                <CardContent className="p-8">
                  <div
                    className={`border-2 border-dashed rounded-xl p-12 text-center transition-smooth ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                  >
                    <div className="flex flex-col items-center space-y-4">
                      {/* Скрытый input для выбора файла */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept=".pdf,.doc,.docx,.txt"
                        className="hidden"
                      />

                      {selectedFile ? (
                        <div className="space-y-4 w-full max-w-md">
                          <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <FileSearch className="h-8 w-8 text-primary" />
                              <div>
                                <p className="font-medium text-sm">{selectedFile.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={removeFile}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            size="lg"
                            className="w-full shadow-elegant"
                            onClick={analyzeDocument}
                            disabled={isAnalyzing}
                          >
                            {isAnalyzing ? "Анализирую..." : "Проанализировать документ"}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Upload className="h-10 w-10" />
                          </div>
                          <p className="text-lg font-medium text-foreground">
                            Перетащите файл или выберите его
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Поддерживаются форматы: PDF, DOCX, DOC, TXT (до 10 МБ)
                          </p>
                          <Button
                            size="lg"
                            className="shadow-elegant"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Выбрать файл
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Analysis Results */}
              <Card className="border-border/50">
                <CardContent className="p-8">
                  <h2 className="text-2xl font-bold text-foreground mb-6">
                    Результаты анализа
                  </h2>
                  {analysisResult ? (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium">Анализ завершен</span>
                      </div>
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown className="text-sm text-muted-foreground leading-relaxed">
                          {analysisResult}
                        </ReactMarkdown>
                      </div>
                      <div className="pt-4 border-t">
                        <p className="text-xs text-muted-foreground">
                          ⚠️ Этот анализ носит рекомендательный характер. Для принятия юридически значимых решений рекомендуем консультацию с квалифицированным юристом.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 text-center py-12">
                      <FileSearch className="h-12 w-12 text-muted-foreground mx-auto opacity-50" />
                      <p className="text-muted-foreground">
                        {selectedFile ? "Нажмите 'Проанализировать документ' для начала анализа" : "Загрузите документ для начала анализа"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Info Section */}
            <div className="space-y-6">
              <Card className="gradient-card border-border/50 shadow-elegant">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    Что анализирует Галина?
                  </h3>
                  <ul className="space-y-3">
                    {[
                      "Ключевые условия и положения",
                      "Потенциальные риски и проблемы",
                      "Соответствие законодательству",
                      "Рекомендации по улучшению",
                      "Сроки и обязательства сторон",
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-primary/5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        Важно
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Анализ Галины носит рекомендательный характер. Для принятия юридически значимых решений рекомендуем консультацию с квалифицированным юристом.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DocumentAnalysis;
