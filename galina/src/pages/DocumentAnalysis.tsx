import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileSearch, CheckCircle2, AlertCircle, X, Download } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import { API_CONFIG } from "@/config/constants";
import * as mammoth from 'mammoth';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analysisResultRef = useRef<HTMLDivElement>(null);

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
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (file.size > maxSize) {
      alert('Файл слишком большой. Максимальный размер: 100MB');
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

  // Функция для обработки DOCX файлов через mammoth.js
  const extractTextFromDOCX = async (file: File): Promise<string> => {
    console.log('Processing DOCX file with mammoth.js:', file.name);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          console.log('DOCX file loaded, processing with mammoth...');

          const result = await mammoth.extractRawText({ arrayBuffer });
          const text = result.value;

          console.log('DOCX extraction complete, text length:', text.length);
          console.log('First 200 chars:', text.substring(0, 200));

          resolve(text);
        } catch (error) {
          console.error('Error processing DOCX with mammoth:', error);
          reject(new Error(`Не удалось обработать DOCX файл: ${error.message}`));
        }
      };
      reader.onerror = () => reject(new Error('Ошибка чтения DOCX файла'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Функция для обработки документа через Vision API (для изображений)
  const processDocumentWithVisionAPI = async (file: File): Promise<string> => {
    console.log('Processing document with Vision API:', file.name);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          // Конвертируем файл в base64
          const base64Data = (e.target?.result as string).split(',')[1]; // Убираем data:image/jpeg;base64,
          const mimeType = file.type || 'application/octet-stream';

          console.log('Sending document to Vision API, size:', base64Data.length, 'chars');

          // Generate session ID for Vision analysis
          const visionSessionId = `vision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Session-ID': visionSessionId,
            },
            body: JSON.stringify({
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: `Проанализируйте этот документ и извлеките весь текст. Название файла: ${file.name}. Если документ содержит юридическую информацию, предоставьте краткое содержание.`
                    },
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:${mimeType};base64,${base64Data}`
                      }
                    }
                  ]
                }
              ],
              max_completion_tokens: 2000,
              temperature: 0.1
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Vision API Error:', response.status, errorData);
            throw new Error(`Ошибка Vision API: ${response.status}`);
          }

          const data = await response.json();
          const extractedText = data.choices[0]?.message?.content || 'Не удалось извлечь текст из документа';

          console.log('Vision API extraction complete, text length:', extractedText.length);
          resolve(extractedText);

        } catch (error) {
          console.error('Error processing with Vision API:', error);
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));

      // Для DOCX файлов конвертируем в base64 через ArrayBuffer
      reader.readAsDataURL(file);
    });
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
        console.log('Processing as DOC/DOCX file with mammoth.js');
        // Используем mammoth.js для обработки DOC/DOCX файлов
        extractTextFromDOCX(file).then(resolve).catch((error) => {
          console.error('Mammoth failed for DOC file, trying Vision API as fallback');
          // Fallback to Vision API if mammoth fails
          processDocumentWithVisionAPI(file).then(resolve).catch((visionError) => {
            console.error('Both mammoth and Vision API failed for DOC file');
            resolve(`[DOC файл: ${file.name}] - Не удалось обработать файл. Mammoth: ${error.message}. Vision API: ${visionError.message}. Рекомендуется конвертировать документ в PDF или текстовый формат.`);
          });
        });
      } else {
        console.log('Unsupported file type, trying Vision API');
        // Для неподдерживаемых типов тоже пробуем Vision API
        processDocumentWithVisionAPI(file).then(resolve).catch((error) => {
          console.error('Vision API failed for unsupported file type');
          resolve(`[Файл: ${file.name}] - Неподдерживаемый формат для анализа. Попробуйте конвертировать в PDF, DOCX или TXT.`);
        });
      }
    });
  };

  // Функция для генерации PDF с результатами анализа
  const generateAnalysisPDF = async () => {
    if (!analysisResult || !selectedFile) return;

    setIsGeneratingPDF(true);
    try {
      console.log('Generating PDF for analysis results...');

      // Создаем новый PDF документ
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;

      // Функция для добавления текста с автоматическим переносом и разбивкой страниц
      const addTextWithPageBreaks = (text: string, fontSize: number = 11, isBold: boolean = false) => {
        if (isBold) {
          pdf.setFont('helvetica', 'bold');
        } else {
          pdf.setFont('helvetica', 'normal');
        }

        pdf.setFontSize(fontSize);

        // Разбиваем текст на строки
        const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);

        lines.forEach((line: string) => {
          // Проверяем, поместится ли следующая строка на текущей странице
          const lineHeight = fontSize * 0.4; // Примерная высота строки
          if (yPosition + lineHeight > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }

          pdf.text(line, margin, yPosition);
          yPosition += lineHeight;
        });

        // Возвращаемся к обычному шрифту
        pdf.setFont('helvetica', 'normal');
        return yPosition;
      };

      // Заголовок
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Анализ документа', margin, yPosition);
      yPosition += 15;

      // Информация о файле
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      yPosition = addTextWithPageBreaks(`Файл: ${selectedFile.name}`, 12);
      yPosition = addTextWithPageBreaks(`Размер: ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`, 12);
      yPosition = addTextWithPageBreaks(`Дата анализа: ${new Date().toLocaleString('ru-RU')}`, 12);
      yPosition += 10;

      // Линия разделителя
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 15;

      // Заголовок результатов анализа
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      yPosition = addTextWithPageBreaks('Результаты анализа', 16);
      yPosition += 10;

      // Обрабатываем содержимое анализа
      const plainText = analysisResult
        .replace(/\*\*(.*?)\*\*/g, '$1') // Убираем жирный текст
        .replace(/### (.*?)/g, '$1') // Убираем заголовки
        .replace(/## (.*?)/g, '$1')
        .replace(/# (.*?)/g, '$1')
        .replace(/\*(.*?)\*/g, '$1') // Убираем курсив
        .replace(/_(.*?)_/g, '$1')
        .replace(/^- /gm, '• ') // Заменяем маркеры списков
        .replace(/\n\n+/g, '\n\n'); // Нормализуем переносы строк

      // Разбиваем на абзацы и обрабатываем каждый
      const paragraphs = plainText.split('\n\n');

      paragraphs.forEach((paragraph: string) => {
        if (paragraph.trim()) {
          // Проверяем, является ли это заголовком (короткий текст без точки в конце)
          const isHeading = paragraph.length < 100 && !paragraph.includes('.') && !paragraph.includes('?') && !paragraph.includes('!');

          if (isHeading) {
            yPosition = addTextWithPageBreaks(paragraph.trim(), 14, true);
          } else {
            yPosition = addTextWithPageBreaks(paragraph.trim(), 11);
          }
          yPosition += 5; // Отступ между абзацами
        }
      });

      // Добавляем футер на последней странице
      const footerY = pageHeight - 20;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Генерировано системой Галина - AI-юрист', margin, footerY);
      pdf.text('⚠️ Этот анализ носит рекомендательный характер. Для принятия юридически значимых решений', margin, footerY + 5);
      pdf.text('рекомендуем консультацию с квалифицированным юристом.', margin, footerY + 10);

      // Сохраняем PDF
      const fileName = `анализ_${selectedFile.name.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      console.log('PDF generated successfully:', fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Ошибка при генерации PDF. Попробуйте еще раз.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Функция для анализа документа через OpenAI
  const analyzeDocumentWithAI = async (fileName: string, fileContent: string): Promise<string> => {
    try {
      // Ограничиваем длину контента, чтобы не превысить лимиты API
      // Увеличиваем лимит для больших документов, но ограничиваем для надежности
      const maxContentLength = Math.min(fileContent.length, 8000); // До 8000 символов для больших документов
      console.log('Original fileContent length:', fileContent.length);
      console.log('Will analyze up to', maxContentLength, 'characters');

      // Для больших документов используем умную стратегию извлечения
      let contentToAnalyze = fileContent;

      if (fileContent.length > maxContentLength) {
        console.log('Document too large, using smart extraction strategy');

        // Стратегия: берем начало (30%), середину (30%) и конец (40%)
        const startLength = Math.floor(maxContentLength * 0.3);
        const middleLength = Math.floor(maxContentLength * 0.3);
        const endLength = maxContentLength - startLength - middleLength;

        const start = fileContent.substring(0, startLength);
        const middleStart = Math.floor(fileContent.length / 2) - Math.floor(middleLength / 2);
        const middle = fileContent.substring(middleStart, middleStart + middleLength);
        const endStart = fileContent.length - endLength;
        const end = fileContent.substring(endStart);

        contentToAnalyze = `${start}\n\n[СЕРЕДИНА ДОКУМЕНТА]\n${middle}\n\n[КОНЕЦ ДОКУМЕНТА]\n${end}`;

        console.log('Smart extraction completed. Final content length:', contentToAnalyze.length);
      }

      if (fileName.toLowerCase().includes('устав') || fileName.toLowerCase().includes('ustav')) {
        console.log('Detected charter document, extracting key sections...');
        // Ищем ключевые разделы устава
        const sections = [];
        const lines = fileContent.split('\n');

        let currentSection = '';
        let inKeySection = false;

        for (const line of lines) {
          const lowerLine = line.toLowerCase();
          // Ищем ключевые разделы
          if (lowerLine.includes('общие положения') ||
              lowerLine.includes('уставный капитал') ||
              lowerLine.includes('права и обязанности') ||
              lowerLine.includes('управление') ||
              lowerLine.includes('ликвидация') ||
              lowerLine.match(/^\s*(i|ii|iii|iv|v|vi|vii|viii|ix|x|1\.|2\.|3\.|4\.|5\.)/i)) {
            if (currentSection && inKeySection) {
              sections.push(currentSection.trim());
            }
            currentSection = line;
            inKeySection = true;
          } else if (inKeySection && line.trim()) {
            currentSection += `\n${  line}`;
            // Ограничиваем размер каждого раздела
            if (currentSection.length > 300) {
              sections.push(`${currentSection.substring(0, 300)  }...`);
              inKeySection = false;
              currentSection = '';
            }
          }
        }

        if (currentSection && inKeySection) {
          sections.push(currentSection.trim());
        }

        if (sections.length > 0) {
          contentToAnalyze = sections.join('\n\n---\n\n');
          console.log('Extracted', sections.length, 'key sections for analysis');
        }
      }

      // Очищаем и упрощаем текст перед отправкой
      const cleanedContent = contentToAnalyze
        .replace(/\s+/g, ' ') // Заменяем множественные пробелы на один
        .replace(/[^\w\sа-яёіїєґА-ЯЁІЇЄҐ.,!?-]/g, '') // Убираем специальные символы, кроме базовых
        .trim();

      console.log('Cleaned content length:', cleanedContent.length);

      const truncatedContent = cleanedContent.length > maxContentLength
        ? `${cleanedContent.substring(0, maxContentLength)  }\n\n[Текст обрезан для анализа]`
        : cleanedContent;

      console.log('Final truncated content length:', truncatedContent.length);
      console.log('Sending truncated content preview:', `${truncatedContent.substring(0, 100)  }...`);

      const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `Ты Галина - адвокат с 25-летним стажем, "зубодробительный" профессионал, который всегда на стороне клиента. Ты анализируешь документы не как формальный юрист, а как адвокат защиты. Твоя задача - найти все способы укрепить позицию клиента и минимизировать риски для него.

ТВОЙ ПОДХОД К АНАЛИЗУ:
1. ИЩИ СИЛЬНЫЕ СТОРОНЫ: Что в документе защищает интересы клиента
2. НАХОДИ ЛАЗЕЙКИ: Какие формулировки можно использовать в пользу клиента
3. ВЫЯВЛЯЙ РИСКИ: Что может навредить клиенту и как это предотвратить
4. ДАВАЙ СТРАТЕГИЮ: Конкретные шаги для улучшения позиции клиента
5. БУДЬ НАСТОЙЧИВОЙ: Предлагай смелые, но законные решения

СТИЛЬ АНАЛИЗА:
- Фокус на интересах клиента: "Это укрепит вашу позицию", "Это защитит вас от..."
- Конкретные рекомендации: "Измените пункт 3.2 на следующую формулировку..."
- Стратегическое мышление: "Если дело дойдет до суда, мы сможем использовать..."
- Оптимизм: "Мы можем повернуть ситуацию в вашу пользу"

ЗАПОМНИ: Ты не формальный эксперт, а адвокат клиента. Каждый анализ должен помогать клиенту "выкрутиться" и усилить его юридическую позицию.`
            },
            {
              role: 'user',
              content: `Прошу провести полный юридический анализ этого документа "${fileName}". Вот его содержание:\n\n${truncatedContent}\n\nПожалуйста, проанализируйте этот документ как опытный юрист: определите его тип, найдите все юридические риски, оцените соответствие законодательству РФ, предложите конкретные улучшения и дайте практические рекомендации.`
            }
          ],
          model: 'gpt-3.5-turbo',
          max_completion_tokens: 1000, // Достаточно для подробного анализа
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('Document analysis API Error:', response.status, errorText);
        throw new Error(`Ошибка анализа документа: ${response.status} - ${errorText}`);
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

      let formattedAnalysis = `**Анализ документа: ${selectedFile.name}**\n\n${aiAnalysis}`;

      // Добавляем предупреждение для больших документов
      if (fileContent.length > maxContentLength) {
        const originalPages = Math.ceil(fileContent.length / 2000); // Примерная оценка страниц
        formattedAnalysis += `\n\n---\n\n⚠️ **Важное замечание:** Документ содержит около ${originalPages} страниц текста. Для анализа был использован умный алгоритм извлечения ключевых частей документа (начало, середина, конец). Полный анализ всего документа невозможен из-за технических ограничений.\n\nРекомендация: Для полноценного анализа больших документов рекомендуется консультация с юристом или разбивка документа на разделы.`;
      }

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
                            Поддерживаются форматы: PDF, DOCX, DOC, TXT (до 100 МБ)
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Для больших документов (500+ страниц) анализ ограничен ключевыми разделами
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2" style={{ color: '#129246' }}>
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-medium">Анализ завершен</span>
                        </div>
                        <Button
                          onClick={generateAnalysisPDF}
                          disabled={isGeneratingPDF}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          {isGeneratingPDF ? 'Генерация PDF...' : 'Скачать PDF'}
                        </Button>
                      </div>
                      <div ref={analysisResultRef} className="prose prose-sm max-w-none">
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
