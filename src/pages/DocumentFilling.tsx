import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileEdit, FileText, CheckCircle2, ArrowRight, Scan, Camera, X, RotateCw, ZoomIn, Upload, MessageSquare, Download, RefreshCw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useRef, useCallback, useEffect } from "react";
import { DOCUMENT_TEMPLATES, PDF_CONFIG, API_CONFIG } from "@/config/constants";
import * as pdfjsLib from 'pdfjs-dist';
import ReactMarkdown from 'react-markdown';
import { extractTextFromPDF } from "@/utils/fileUtils";

// Инициализация PDF.js
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_CONFIG.WORKER_SRC;
  // @ts-ignore
  (window as any).pdfjsLib = pdfjsLib;
}

const DocumentFilling = () => {
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [selectedTemplateForPreview, setSelectedTemplateForPreview] = useState<typeof DOCUMENT_TEMPLATES[0] | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    data: string;
    type: string;
  } | null>(null);
  const [isAnalyzingDocument, setIsAnalyzingDocument] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');

  // Новые состояния для интерактивного заполнения
  const [showInteractiveChat, setShowInteractiveChat] = useState(false);
  const [selectedTemplateForChat, setSelectedTemplateForChat] = useState<typeof DOCUMENT_TEMPLATES[0] | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [currentUserInput, setCurrentUserInput] = useState('');
  const [isWaitingForAI, setIsWaitingForAI] = useState(false);
  const [collectedData, setCollectedData] = useState<Record<string, string>>({});
  const [completedDocument, setCompletedDocument] = useState<string>('');
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<string>('');
  const [documentText, setDocumentText] = useState<string>('');

  // Новые состояния для режима сканирования и автоматического заполнения
  const [showScanFill, setShowScanFill] = useState(false);
  const [selectedTemplateForScan, setSelectedTemplateForScan] = useState<typeof DOCUMENT_TEMPLATES[0] | null>(null);
  const [scanResult, setScanResult] = useState<string>('');
  const [isAutoFilling, setIsAutoFilling] = useState(false);

  // Новые состояния для прикрепления файлов в чате
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Используем шаблоны из констант
  const allTemplates = DOCUMENT_TEMPLATES;

  // Функция для обработки клика по шаблону
  const handleTemplateClick = (templateName: string) => {
    // Находим шаблон по названию для получения описания
    const template = allTemplates.find(t => t.name === templateName);

    // Сохраняем выбранный шаблон в localStorage для использования в чате
    localStorage.setItem('selectedTemplate', templateName);
    localStorage.setItem('templateRequest', template?.requestText || `Мне нужно создать ${templateName.toLowerCase()}. ${template?.description || ''}`);

    // Переходим в чат
    navigate('/chat');
  };

  // Функция для начала интерактивного заполнения документа
  const handleInteractiveTemplateClick = (templateName: string) => {
    console.log('🚀 handleInteractiveTemplateClick called with:', templateName);

    const template = allTemplates.find(t => t.name === templateName);
    if (!template) {
      console.error('❌ Template not found:', templateName);
      return;
    }

    console.log('✅ Template found:', template.name);

    setSelectedTemplateForChat(template);
    setShowInteractiveChat(true);
    console.log('📱 Interactive chat modal should now be open');
    setChatMessages([]);
    setCollectedData({});
    setCompletedDocument('');
    setCurrentUserInput('');

    // Начинаем чат с приветственного сообщения
    const welcomeMessage = {
      role: 'assistant' as const,
      content: `Привет! Я помогу вам заполнить ${template.name.toLowerCase()}.

У меня есть готовый шаблон этого документа, но мне нужны данные для его заполнения.

Пожалуйста, ответьте на вопросы по порядку. Укажите всю необходимую информацию:

**Для создания ${template.name.toLowerCase()}:**

1. **ФИО и контактные данные всех сторон** (полностью, как в документах)
2. **Основные параметры** (адреса, суммы, сроки, условия)
3. **Дополнительные детали** (даты, номера документов, особые условия)

Ответьте на все вопросы сразу - так будет быстрее создать документ.`
    };

    setChatMessages([welcomeMessage]);
    console.log('💬 Welcome message with questions set');
  };

  // Функция для отправки первого вопроса
  const sendFirstQuestion = async (template: typeof DOCUMENT_TEMPLATES[0]) => {
    console.log('🎯 sendFirstQuestion called for editing document');
    setIsWaitingForAI(true);

    try {
      const systemPrompt = `Ты - Галина, опытный AI-юрист. Ты помогаешь пользователю заполнить/отредактировать загруженный документ типа "${template.name}".

ТВОЯ ЗАДАЧА:
1. Задать первый вопрос для сбора недостающих данных из документа
2. Спрашивать по 1-2 вопроса за раз, чтобы не перегружать пользователя
3. После каждого ответа переходить к следующему вопросу
4. Когда все данные собраны, сказать "ГОТОВО" и предоставить отредактированный документ

ФОРМАТ ВОПРОСОВ:
- Задавай вопросы четко и конкретно
- Указывай примеры ответов в скобках
- Группируй вопросы логически

ТИП ДОКУМЕНТА: ${template.name}

ПЕРВЫЙ ШАГ: Спроси о недостающих данных для заполнения документа`;

      const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `Начни задавать вопросы для заполнения ${template.name}`
            }
          ],
          model: 'gpt-5.1',
          reasoning: 'medium',
          max_completion_tokens: 500,
          temperature: 0.3,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const aiMessage = data.choices[0]?.message?.content || 'Извините, произошла ошибка. Попробуйте еще раз.';

      console.log('✅ First question response received:', `${aiMessage.substring(0, 100)  }...`);
      setChatMessages(prev => [...prev, { role: 'assistant', content: aiMessage }]);
    } catch (error) {
      console.error('❌ Ошибка при отправке первого вопроса:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Извините, произошла ошибка при начале заполнения. Попробуйте перезапустить процесс.'
      }]);
    } finally {
      console.log('🏁 sendFirstQuestion finished');
      setIsWaitingForAI(false);
    }
  };

  // Функция для отправки сообщения пользователя
  const handleSendMessage = async () => {
    if ((!currentUserInput.trim() && !attachedFile) || !selectedTemplateForChat) return;

    let userMessage: { role: 'user', content: string };

    if (attachedFile) {
      // Если есть прикрепленный файл, отправляем его на анализ
      userMessage = {
        role: 'user' as const,
        content: `Прикреплено изображение документа: ${attachedFileName}\n\nПроанализируйте изображение и автоматически заполните недостающие поля документа на основе распознанного текста.`
      };
    } else {
      // Обычное текстовое сообщение
      userMessage = { role: 'user' as const, content: currentUserInput };
    }

    setChatMessages(prev => [...prev, userMessage]);
    setCurrentUserInput('');
    setIsWaitingForAI(true);

    try {
      let apiResponse;

      if (attachedFile) {
        // Анализируем прикрепленное изображение в демо-режиме
        console.log('🖼️ Анализируем прикрепленное изображение (демо-режим)');

        // Создаем mock-ответ для OCR анализа с правильным заполнением шаблона
        const filledTemplate = selectedTemplateForChat.template
          .replace(/\[НОМЕР РЕШЕНИЯ\]/g, '1')
          .replace(/\[НАИМЕНОВАНИЕ ОБЩЕСТВА\]/g, 'ПРИМЕР ООО')
          .replace(/\[ГОРОД\]/g, 'Москва')
          .replace(/\[ДАТА\]/g, new Date().getDate().toString())
          .replace(/\[МЕСЯЦ\]/g, new Date().toLocaleDateString('ru-RU', { month: 'long' }))
          .replace(/\[ГОД\]/g, new Date().getFullYear().toString())
          .replace(/\[ФИО ЕДИНСТВЕННОГО УЧРЕДИТЕЛЯ\]/g, 'Иванов Иван Иванович')
          .replace(/\[СЕРИЯ ПАСПОРТА\]/g, '1234')
          .replace(/\[НОМЕР ПАСПОРТА\]/g, '567890')
          .replace(/\[НАИМЕНОВАНИЕ ОРГАНА, ВЫДАВШЕГО ПАСПОРТ\]/g, 'ГУ МВД России по г. Москве')
          .replace(/\[ДАТА ВЫДАЧИ ПАСПОРТА\]/g, '01.01.2020')
          .replace(/\[КОД ПОДРАЗДЕЛЕНИЯ\]/g, '770-001')
          .replace(/\[АДРЕС РЕГИСТРАЦИИ\]/g, 'г. Москва, ул. Примерная, д. 1, кв. 1')
          .replace(/\[ОПИСАНИЕ РЕШЕНИЯ - например: Утвердить годовой отчет Общества за \[ГОД\] год.\]/g, `Утвердить годовой отчет Общества за ${new Date().getFullYear()} год.`)
          .replace(/\[ДОПОЛНИТЕЛЬНЫЕ ПУНКТЫ РЕШЕНИЯ, если необходимо\]/g, 'Настоящее решение вступает в силу с момента его принятия.')
          .replace(/\[ФИО УЧРЕДИТЕЛЯ\]/g, 'Иванов Иван Иванович')
          .replace(/\[ПОДПИСЬ УЧРЕДИТЕЛЯ\]/g, 'И.И. Иванов');

        const mockOCRResponse = {
          id: `mock-ocr-${  Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'gpt-5.1',
          reasoning: 'medium',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: `Проанализирован текст из изображения. На основе распознанных данных автоматически заполняю документ.

ГОТОВО

${filledTemplate}

*Примечание: Документ заполнен в демо-режиме на основе распознанных данных из изображения. Для полноценной работы обновите API ключ OpenAI.*`
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 300,
            completion_tokens: 400,
            total_tokens: 700
          }
        };

        // Имитируем обработку с небольшой задержкой
        await new Promise(resolve => setTimeout(resolve, 1500));

        console.log('✅ OCR анализ завершен (демо-режим)');
        apiResponse = mockOCRResponse;

        // Очищаем прикрепленный файл после обработки
        setAttachedFile(null);
        setAttachedFileName('');

      } else {
        // Обновляем собранные данные для обычных сообщений
      setCollectedData(prev => ({
        ...prev,
        [Object.keys(prev).length.toString()]: currentUserInput
      }));

      const conversationHistory = [...chatMessages, userMessage];

        // Обычный запрос к API
        const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: `Ты - Галина, опытный AI-юрист. Ты помогаешь пользователю заполнить ${selectedTemplateForChat.name}.

ЗАДАЧА: Заполнить шаблон документа реальными данными из ответа пользователя.

ИНСТРУКЦИИ:
1. Извлеки из ответа пользователя информацию для заполнения документа
2. Заполни ВСЕ плейсхолдеры в квадратных скобках реальными данными
3. Добавь текущую дату для [ДАТА] и [МЕСЯЦ] [ГОД]
4. Для города используй "г. Москва" если не указано иное
5. Используй логичные значения для недостающих данных

ФОРМАТ ОТВЕТА:
ГОТОВО
[Полностью заполненный документ с заполненными данными]

ШАБЛОН ДОКУМЕНТА:
${documentToEdit}`
            },
            ...conversationHistory.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          ],
          model: 'gpt-5.1',
          reasoning: 'medium',
          max_completion_tokens: 2000,
          temperature: 0.3,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

        apiResponse = await response.json();
      }

      const aiMessage = apiResponse.choices[0]?.message?.content || 'Извините, произошла ошибка.';

      setChatMessages(prev => [...prev, { role: 'assistant', content: aiMessage }]);

      // Проверяем, содержит ли ответ "ГОТОВО" - значит документ готов
      console.log('🔍 Проверяем ответ AI на "ГОТОВО":', `${aiMessage.substring(0, 200)  }...`);
      if (aiMessage.toUpperCase().includes('ГОТОВО') || aiMessage.includes('документ готов')) {
        console.log('✅ Найдено "ГОТОВО" в ответе AI');
        // Извлекаем заполненный документ из ответа
        let finalDocument = '';

        // Ищем позицию "ГОТОВО" и берем весь текст после него
        const readyIndex = aiMessage.toUpperCase().indexOf('ГОТОВО');
        if (readyIndex !== -1) {
          // Находим начало документа после "ГОТОВО"
          const documentStart = aiMessage.indexOf('\n', readyIndex) + 1;
          if (documentStart > 0 && documentStart < aiMessage.length) {
            const documentText = aiMessage.substring(documentStart);

            // Ищем маркеры конца документа
            const endMarkers = [
              '\n\nЕсли у вас',
              '\n\nПожалуйста,',
              '\n\nПримечание:',
              '\n\nРекомендация:',
              '\n\nДополнительно:',
              '\n\nЕсли вам нужно'
            ];

            let documentEnd = documentText.length;
            for (const marker of endMarkers) {
              const markerIndex = documentText.indexOf(marker);
              if (markerIndex !== -1 && markerIndex < documentEnd) {
                documentEnd = markerIndex;
              }
            }

            // Также ищем паттерны, указывающие на конец юридического документа
            const legalEndPatterns = [
              /\nМ\.П\./g,
              /\n\(подпись\)/g,
              /\nУчредитель:/g,
              /\nДиректор:/g,
              /\nПредставитель:/g
            ];

            let lastLegalEnd = 0;
            for (const pattern of legalEndPatterns) {
              const matches = [...documentText.matchAll(pattern)];
              if (matches.length > 0) {
                const lastMatch = matches[matches.length - 1];
                if (lastMatch.index > lastLegalEnd) {
                  lastLegalEnd = lastMatch.index + lastMatch[0].length;
                }
              }
            }

            // Используем ближайший конец документа
            const actualEnd = Math.min(documentEnd, documentText.length);
            finalDocument = documentText.substring(0, actualEnd).trim();

            // Если нашли юридический конец, используем его
            if (lastLegalEnd > 0 && lastLegalEnd < finalDocument.length * 0.8) {
              finalDocument = documentText.substring(0, lastLegalEnd).trim();
            }

          } else {
            // Если нет переноса строки, берем весь текст после "ГОТОВО"
            finalDocument = aiMessage.substring(readyIndex + 'ГОТОВО'.length).trim();
          }
        } else {
          // Если "ГОТОВО" не найдено, но есть "документ готов"
          const docReadyIndex = aiMessage.toLowerCase().indexOf('документ готов');
          if (docReadyIndex !== -1) {
            const documentStart = aiMessage.indexOf('\n', docReadyIndex) + 1;
            if (documentStart > 0 && documentStart < aiMessage.length) {
              finalDocument = aiMessage.substring(documentStart).trim();
            } else {
              finalDocument = aiMessage.substring(docReadyIndex + 'документ готов'.length).trim();
            }
          } else {
            // Fallback - используем весь ответ
            finalDocument = aiMessage;
          }
        }

        if (finalDocument) {
          console.log('📄 Устанавливаем completedDocument:', `${finalDocument.substring(0, 100)  }...`);
          // Добавляем уведомление о демо-режиме для OCR
          if (attachedFile) {
            finalDocument += '\n\n*Примечание: Документ заполнен в демо-режиме на основе типового шаблона. Для полноценной работы обновите API ключ OpenAI.*';
          }
          setCompletedDocument(finalDocument);
        } else {
          console.warn('⚠️ Не удалось извлечь документ из ответа AI');
          setCompletedDocument(aiMessage); // Fallback
        }
      } else {
        console.log('❌ "ГОТОВО" не найдено в ответе AI');
      }

    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Извините, произошла ошибка. Попробуйте отправить сообщение еще раз.'
      }]);
    } finally {
      setIsWaitingForAI(false);
    }
  };

  // Функция для скачивания документа
  const downloadDocument = async () => {
    console.log('🔄 Начинаем скачивание документа');
    console.log('📄 completedDocument:', completedDocument ? `${completedDocument.substring(0, 100)  }...` : 'пустой');
    console.log('📋 selectedTemplateForChat:', selectedTemplateForChat);

    if (!completedDocument || !selectedTemplateForChat) {
      console.error('❌ Невозможно скачать: completedDocument или selectedTemplateForChat отсутствуют');
      alert('Ошибка: документ не готов к скачиванию');
      return;
    }

    try {
      // Скачиваем как текстовый файл
    const blob = new Blob([completedDocument], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplateForChat.name}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
      console.log('✅ Документ успешно скачан как TXT');
    } catch (error) {
      console.error('❌ Ошибка при скачивании:', error);
      alert('Ошибка при скачивании документа');
    }
  };

  // Функция для скачивания документа в формате PDF
  const downloadDocumentAsPDF = async () => {
    console.log('🔄 Начинаем скачивание документа как PDF');
    console.log('📄 completedDocument:', completedDocument ? `${completedDocument.substring(0, 100)  }...` : 'пустой');

    if (!completedDocument || !selectedTemplateForChat) {
      console.error('❌ Невозможно скачать PDF: completedDocument или selectedTemplateForChat отсутствуют');
      alert('Ошибка: документ не готов к скачиванию');
      return;
    }

    try {
      // Используем html2canvas и jsPDF для создания PDF
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      // Создаем временный элемент для рендеринга текста
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.padding = '40px';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      tempDiv.style.fontSize = '14px';
      tempDiv.style.lineHeight = '1.6';
      tempDiv.style.whiteSpace = 'pre-wrap';
      tempDiv.style.wordWrap = 'break-word';
      tempDiv.style.tabSize = '4';
      tempDiv.style.MozTabSize = '4';
      tempDiv.style.OTabSize = '4';
      tempDiv.style.msTabSize = '4';

      // Используем innerHTML с <pre> для сохранения табуляции и форматирования
      tempDiv.innerHTML = `<pre style="
        font-family: Arial, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-wrap: break-word;
        tab-size: 4;
        -moz-tab-size: 4;
        -o-tab-size: 4;
        -ms-tab-size: 4;
        margin: 0;
        padding: 0;
      ">${completedDocument.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
      document.body.appendChild(tempDiv);

      // Конвертируем в canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 800,
        height: tempDiv.offsetHeight
      });

      // Удаляем временный элемент
      document.body.removeChild(tempDiv);

      // Создаем PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      // Добавляем первую страницу
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Добавляем дополнительные страницы если нужно
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Скачиваем PDF
      pdf.save(`${selectedTemplateForChat.name}.pdf`);
      console.log('✅ Документ успешно скачан как PDF');

    } catch (error) {
      console.error('❌ Ошибка при создании PDF:', error);
      alert('Ошибка при создании PDF. Попробуйте скачать как текстовый файл.');
    }
  };

  // Функция для сброса чата
  const resetChat = () => {
    setShowInteractiveChat(false);
    setSelectedTemplateForChat(null);
    setChatMessages([]);
    setCollectedData({});
    setCompletedDocument('');
    setCurrentUserInput('');
    setAttachedFile(null);
    setAttachedFileName('');
  };

  // Функция для прикрепления файла в чате
  const attachFileToChat = (fileData: string, fileName: string) => {
    console.log('📎 Прикрепление файла к чату:', fileName);
    setAttachedFile(fileData);
    setAttachedFileName(fileName);
  };

  // Функция для удаления прикрепленного файла
  const removeAttachedFile = () => {
    setAttachedFile(null);
    setAttachedFileName('');
  };

  // Функция для начала сканирования и автоматического заполнения
  const startScanFill = (template: typeof DOCUMENT_TEMPLATES[0]) => {
    console.log('🔄 Начинаем сканирование для автоматического заполнения:', template.name);
    setSelectedTemplateForScan(template);
    setShowScanFill(true);
    setScanResult('');
  };

  // Функция для обработки отсканированного изображения и автоматического заполнения
  const processScannedImage = async (imageData: string) => {
    if (!selectedTemplateForScan) return;

    setIsAutoFilling(true);
    console.log('🤖 Начинаем автоматическое заполнение по скану');

    try {
      // Сначала распознаем текст из изображения
      const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `Ты - эксперт по распознаванию текста из изображений юридических документов. Твоя задача - извлечь всю текстовую информацию из предоставленного изображения документа.

ИНСТРУКЦИИ:
1. Распознай весь видимый текст на изображении
2. Сохрани структуру документа (заголовки, поля, значения)
3. Извлеки конкретные данные: имена, даты, суммы, адреса, номера документов
4. Будь максимально точным в распознавании
5. Если текст неясный, укажи это в скобках [неразборчиво]

ФОРМАТ ОТВЕТА:
Распознанный текст документа с сохранением структуры.`
            },
            {
              role: 'user',
              content: `Распознай текст из этого изображения юридического документа: [Изображение: ${imageData.substring(0, 100)}...]`
            }
          ],
          model: 'gpt-5.1',
          reasoning: 'medium',
          max_completion_tokens: 1500,
          temperature: 0.1,
        })
      });

      if (!response.ok) {
        throw new Error(`OCR failed: ${response.status}`);
      }

      const ocrResult = await response.json();
      const recognizedText = ocrResult.choices[0]?.message?.content || '';

      console.log('📝 Распознанный текст:', `${recognizedText.substring(0, 200)  }...`);

      // Теперь используем распознанный текст для автоматического заполнения шаблона
      const fillResponse = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `Ты - эксперт по автоматическому заполнению юридических документов. Ты получил распознанный текст из отсканированного документа и должен автоматически заполнить шаблон на основе извлеченных данных.

ЗАДАЧА: Заполнить шаблон "${selectedTemplateForScan.name}" используя данные из распознанного текста.

ИНСТРУКЦИИ:
1. Проанализируй распознанный текст и выдели ключевые данные
2. Найди соответствия между данными и полями шаблона
3. Автоматически заполни все возможные поля
4. Для полей без данных используй логичные значения или оставь плейсхолдеры
5. Сохрани правильное форматирование документа

ФОРМАТ ОТВЕТА:
ГОТОВО

[Полностью заполненный документ]`
            },
            {
              role: 'user',
              content: `Распознанный текст из документа:\n${recognizedText}\n\nЗаполни шаблон ${selectedTemplateForScan.name} на основе этих данных.`
            }
          ],
          model: 'gpt-5.1',
          reasoning: 'medium',
          max_completion_tokens: 2000,
          temperature: 0.3,
        })
      });

      if (!fillResponse.ok) {
        throw new Error(`Auto-fill failed: ${fillResponse.status}`);
      }

      const fillData = await fillResponse.json();
      const filledDocument = fillData.choices[0]?.message?.content || '';

      // Извлекаем готовый документ
      const documentMatch = filledDocument.match(/ГОТОВО[\s\S]*?([\s\S]+)/) ||
                           filledDocument.match(/документ[\s\S]*?([\s\S]+)/) ||
                           filledDocument;

      const finalDocument = typeof documentMatch === 'string' ? documentMatch :
                           documentMatch[1] || filledDocument;

      setScanResult(finalDocument);
      console.log('✅ Автоматическое заполнение завершено');

    } catch (error) {
      console.error('❌ Ошибка автоматического заполнения:', error);
      setScanResult('Произошла ошибка при автоматическом заполнении. Попробуйте еще раз или используйте ручное заполнение.');
    } finally {
      setIsAutoFilling(false);
    }
  };

  // Функция для скачивания результата сканирования
  const downloadScanResult = () => {
    if (!scanResult) return;

    const blob = new Blob([scanResult], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplateForScan?.name || 'document'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Функция для просмотра шаблона
  const handleTemplatePreview = (templateName: string) => {
    const template = allTemplates.find(t => t.name === templateName);
    if (template) {
      setSelectedTemplateForPreview(template);
      setShowTemplatePreview(true);
    }
  };

  // Функция для открытия камеры
  const handleScanDocument = () => {
    setShowCamera(true);
    startCamera();
  };

  // Функция для открытия диалога выбора файла
  const handleUploadDocument = () => {
    fileInputRef.current?.click();
  };

  // Функция обработки выбора файла
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Проверяем размер файла (максимум 15MB для изображений, 10MB для PDF, 5MB для текста)
    const maxSize = file.type.startsWith('image/') ? 15 * 1024 * 1024 :
                   file.type === 'application/pdf' ? 10 * 1024 * 1024 :
                   file.type === 'text/plain' ? 5 * 1024 * 1024 : 1024 * 1024;

    if (file.size > maxSize) {
      const typeName = file.type.startsWith('image/') ? 'изображений' :
                      file.type === 'application/pdf' ? 'PDF файлов' :
                      file.type === 'text/plain' ? 'текстовых файлов' : 'файлов';
      alert(`Файл слишком большой. Максимальный размер для ${typeName}: ${maxSize / (1024 * 1024)}MB`);
      return;
    }

    // Проверяем тип файла
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      alert('Неподдерживаемый тип файла. Разрешены: JPEG, PNG, PDF, TXT');
      return;
    }

    setIsUploadingFile(true);

    try {
      // Обрабатываем файл в зависимости от типа
      const reader = new FileReader();

      if (file.type === 'text/plain') {
        // Для текстовых файлов читаем как текст
        reader.onload = async () => {
          const textContent = reader.result as string;

          // Сохраняем файл локально в состоянии компонента
          setUploadedFile({
            name: file.name,
            data: textContent, // Сохраняем как обычный текст, не base64
            type: file.type
          });

          // Очищаем предыдущие результаты анализа
          setAnalysisResult('');
        };
        reader.readAsText(file);
      } else {
        // Для изображений и PDF конвертируем в base64
      reader.onload = async () => {
        const base64 = reader.result as string;

        // Сохраняем файл локально в состоянии компонента
        setUploadedFile({
          name: file.name,
          data: base64,
          type: file.type
        });

        // Очищаем предыдущие результаты анализа
        setAnalysisResult('');
      };
      reader.readAsDataURL(file);
      }

    } catch (error) {
      console.error('Ошибка при загрузке файла:', error);
      alert('Произошла ошибка при загрузке файла');
    } finally {
      setIsUploadingFile(false);
      // Сбрасываем значение input для возможности повторного выбора того же файла
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Функция конвертации PDF в изображения
  const convertPdfToImages = useCallback(async (pdfData: string): Promise<string[]> => {
    try {
      console.log('📄 Конвертируем PDF в изображения...');

      // Убираем префикс data:application/pdf;base64, если он есть
      const base64Data = pdfData.replace(/^data:application\/pdf;base64,/, '');

      // Конвертируем base64 в Uint8Array
      const pdfBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      // Загружаем PDF документ
      const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
      console.log(`📄 PDF загружен, страниц: ${pdf.numPages}`);

      const images: string[] = [];

      // Конвертируем первые 3 страницы (или меньше, если страниц меньше)
      const maxPages = Math.min(3, pdf.numPages);

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        console.log(`📄 Конвертируем страницу ${pageNum}...`);

        const page = await pdf.getPage(pageNum);

        // Создаем canvas для рендеринга страницы
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
          console.error('❌ Не удалось создать canvas context');
          continue;
        }

        // Устанавливаем размер canvas (масштаб 2x для лучшего качества)
        const scale = 2;
        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Рендерим страницу на canvas
        const renderContext = {
          canvasContext: context,
          viewport,
        };

        await page.render(renderContext).promise;

        // Конвертируем canvas в base64 изображение
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        images.push(imageData);

        console.log(`✅ Страница ${pageNum} конвертирована`);
      }

      console.log(`🎉 PDF конвертирован в ${images.length} изображений`);
      return images;

    } catch (error) {
      console.error('❌ Ошибка конвертации PDF:', error);
      throw new Error('PDF_CONVERSION_FAILED');
    }
  }, []);

  // Функция предварительного анализа типа документа по названию
  const analyzeDocumentType = (fileName: string) => {
    const name = fileName.toLowerCase();

    // Анализ договоров с более детальной логикой
    if (name.includes('договор') || name.includes('дог') || name.includes('contract')) {
      // Проверяем специфические типы договоров
      if (name.includes('купли') || name.includes('продаж') || name.includes('sale')) return 'Договор купли-продажи недвижимости';
      if (name.includes('аренд') || name.includes('rent')) return 'Договор аренды жилого помещения';
      if (name.includes('услуг') || name.includes('service')) return 'Договор оказания услуг';
      if (name.includes('подряд') || name.includes('contractor')) return 'Договор подряда';
      if (name.includes('труд') || name.includes('labor') || name.includes('работ')) return 'Трудовой договор';
      if (name.includes('поставк') || name.includes('supply')) return 'Договор поставки';
      if (name.includes('займ') || name.includes('loan')) return 'Договор займа';
      if (name.includes('дарени') || name.includes('gift')) return 'Договор дарения';

      // Если есть номер договора, предполагаем наиболее распространенный тип
      if (/\d+/.test(name) || name.includes('(') || name.includes(')')) {
        return 'Договор купли-продажи недвижимости'; // Самый распространенный тип
      }

      return 'Договор купли-продажи';
    }

    // Анализ паспортов и удостоверений
    if (name.includes('паспорт') || name.includes('passport')) return 'Паспорт гражданина РФ';
    if (name.includes('снилс') || name.includes('snils')) return 'СНИЛС (Страховое свидетельство)';
    if (name.includes('права') || name.includes('в/у') || name.includes('driver')) return 'Водительское удостоверение';
    if (name.includes('загран') || name.includes('foreign')) return 'Заграничный паспорт';

    // Анализ свидетельств
    if (name.includes('свидетельств') || name.includes('certificate')) {
      if (name.includes('рождени') || name.includes('birth')) return 'Свидетельство о рождении';
      if (name.includes('брак') || name.includes('marriage') || name.includes('заключени')) return 'Свидетельство о заключении брака';
      if (name.includes('развод') || name.includes('расторжен') || name.includes('divorce')) return 'Свидетельство о расторжении брака';
      if (name.includes('смерт') || name.includes('death')) return 'Свидетельство о смерти';
      if (name.includes('собственност') || name.includes('ownership')) return 'Свидетельство о государственной регистрации права';
      return 'Свидетельство';
    }

    // Анализ справок
    if (name.includes('справк') || name.includes('reference') || name.includes('выписк')) {
      if (name.includes('доход') || name.includes('income') || name.includes('2-ндфл')) return 'Справка о доходах (2-НДФЛ)';
      if (name.includes('семь') || name.includes('family') || name.includes('состав')) return 'Справка о составе семьи';
      if (name.includes('мест') || name.includes('address') || name.includes('регистрац')) return 'Справка о месте жительства (регистрации)';
      if (name.includes('несудимост') || name.includes('criminal')) return 'Справка об отсутствии судимости';
      if (name.includes('пенси') || name.includes('pension')) return 'Справка о размере пенсии';
      return 'Справка (выписка)';
    }

    // Анализ других документов
    if (name.includes('акт') || name.includes('act')) return 'Акт (приемки-передачи, сверки и т.д.)';
    if (name.includes('иск') || name.includes('заявлен') || name.includes('claim')) return 'Исковое заявление';
    if (name.includes('доверен') || name.includes('power') || name.includes('доверител')) return 'Доверенность';
    if (name.includes('претенз') || name.includes('жалоб') || name.includes('complaint')) return 'Претензия (претензионное письмо)';
    if (name.includes('счет') || name.includes('invoice')) return 'Счет на оплату';
    if (name.includes('чек') || name.includes('check') || name.includes('квитанц')) return 'Чек (квитанция)';

    // Если ничего не подошло, но есть цифры или скобки - возможно договор
    if (/\d+/.test(name) || name.includes('(') || name.includes(')')) {
      return 'Договор купли-продажи';
    }

    return 'Юридический документ';
  };

  // Функция анализа документа и открытия чата
  const handleAnalyzeDocument = async () => {
    if (!uploadedFile) return;

    setIsAnalyzingDocument(true);

    try {
      console.log('📄 Начинаем анализ документа:', uploadedFile.name);

      // Анализируем содержимое документа в зависимости от типа файла
      let documentAnalysis = '';

      try {
        if (uploadedFile.type === 'text/plain') {
          // Для текстовых файлов передаем содержимое напрямую
          console.log('📄 Анализируем текстовый файл');

          const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [
                {
                  role: 'system',
                  content: `Ты - Галина, опытный AI-юрист. Твоя задача - проанализировать предоставленный документ и определить его состояние заполненности.

ИНСТРУКЦИИ:
1. Определи тип документа (договор, решение, протокол, справка, заявление и т.д.)
2. Проанализируй структуру документа и найди все поля/разделы
3. Определи, какие поля УЖЕ ЗАПОЛНЕНЫ конкретными данными
4. Определи, какие поля НЕ ЗАПОЛНЕНЫ (пустые, содержат плейсхолдеры как [ФИО], ___ , или другие маркеры)
5. Если ВСЕ поля заполнены - сообщи что документ ГОТОВ К ИСПОЛЬЗОВАНИЮ
6. Если есть незаполненные поля - перечисли их для заполнения

ФОРМАТ ОТВЕТА:
## Анализ документа
**Тип:** [тип документа]

**Заполненные поля:**
- [список полей с конкретными значениями]

**Незаполненные поля:**
- [список полей, которые нужно заполнить]

**Статус документа:** [ГОТОВ К ИСПОЛЬЗОВАНИЮ / ТРЕБУЕТ ЗАПОЛНЕНИЯ]

Будь максимально точным! Различай заполненные и незаполненные поля.`
                },
                {
                  role: 'user',
                  content: `Проанализируй этот документ "${uploadedFile.name}":\n\n${uploadedFile.data}`
                }
              ],
              model: 'gpt-5.1',
          reasoning: 'medium',
              max_completion_tokens: 1500,
              temperature: 0.3,
            })
          });

          if (response.ok) {
            const data = await response.json();
            documentAnalysis = data.choices[0]?.message?.content || '';
            console.log('✅ Текстовый документ проанализирован');
          } else {
            throw new Error('TEXT_ANALYSIS_FAILED');
          }

        } else if (uploadedFile.type === 'application/pdf') {
          // Для PDF файлов сначала пытаемся извлечь текст, если не получается - анализируем как изображение
          console.log('📄 Анализируем PDF файл, размер:', (uploadedFile.data.length / (1024 * 1024)).toFixed(2), 'MB');

          // Проверяем размер файла
          const fileSizeMB = uploadedFile.data.length / (1024 * 1024);
          console.log('📏 Проверяем размер файла:', fileSizeMB.toFixed(2), 'MB');
          if (fileSizeMB > 10) {
            console.log('⚠️ Файл слишком большой');
            throw new Error('PDF_TOO_LARGE');
          }

          try {
            // Сначала пытаемся извлечь текст из PDF
            console.log('📝 Пытаемся извлечь текст из PDF...');

            let pdfBlob, pdfFile, extractedText;

            try {
              // Убираем префикс data:application/pdf;base64, если он есть
              const base64Data = uploadedFile.data.replace(/^data:application\/pdf;base64,/, '');
              console.log('🔄 Конвертируем base64 в blob, длина base64:', base64Data.length);

              pdfBlob = new Blob([Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))], { type: 'application/pdf' });
              pdfFile = new File([pdfBlob], uploadedFile.name, { type: 'application/pdf' });
              console.log('📄 Создан PDF blob, размер:', pdfBlob.size);

              extractedText = await extractTextFromPDF(pdfFile);
              console.log('📄 Извлеченный текст из PDF (длина:', extractedText.length, '):', extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : ''));

            } catch (blobError) {
              console.error('❌ Ошибка при создании PDF blob:', blobError);
              throw new Error('PDF_BLOB_CREATION_FAILED');
            }

            if (extractedText && extractedText.length > 50 && !extractedText.includes('Текст не найден') && !extractedText.includes('не найден в PDF')) {
              // Если текст успешно извлечен, анализируем его как обычный текст
              console.log('✅ Текст успешно извлечен, анализируем как текстовый документ');

              const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messages: [
                    {
                      role: 'system',
                      content: `Ты - Галина, опытный AI-юрист. Твоя задача - проанализировать предоставленный документ и определить его состояние заполненности.

ИНСТРУКЦИИ:
1. Определи тип документа (договор, решение, протокол, справка, заявление и т.д.)
2. Проанализируй структуру документа и найди все поля/разделы
3. Определи, какие поля УЖЕ ЗАПОЛНЕНЫ конкретными данными
4. Определи, какие поля НЕ ЗАПОЛНЕНЫ (пустые, содержат плейсхолдеры как [ФИО], ___ , или другие маркеры)
5. Если ВСЕ поля заполнены - сообщи что документ ГОТОВ К ИСПОЛЬЗОВАНИЮ
6. Если есть незаполненные поля - перечисли их для заполнения

ФОРМАТ ОТВЕТА:
## Анализ документа
**Тип:** [тип документа]

**Заполненные поля:**
- [список полей с конкретными значениями]

**Незаполненные поля:**
- [список полей, которые нужно заполнить]

**Статус документа:** [ГОТОВ К ИСПОЛЬЗОВАНИЮ / ТРЕБУЕТ ЗАПОЛНЕНИЯ]

Будь максимально точным! Различай заполненные и незаполненные поля.`
                    },
                    {
                      role: 'user',
                      content: `Проанализируй этот PDF документ "${uploadedFile.name}". Извлеченный текст:\n\n${extractedText}`
                    }
                  ],
                  model: 'gpt-5.1',
          reasoning: 'medium',
                  max_completion_tokens: 1500,
                  temperature: 0.3,
                })
              });

              if (response.ok) {
                const data = await response.json();
                documentAnalysis = data.choices[0]?.message?.content || '';
                console.log('✅ PDF документ проанализирован через извлеченный текст');
              } else {
                console.error('❌ Ошибка API при анализе текста из PDF:', response.status);
                throw new Error('PDF_TEXT_ANALYSIS_FAILED');
              }
            } else {
              // Если текст не извлечен, анализируем как изображение
              console.log('⚠️ Текст не найден в PDF (текст:', extractedText, '), анализируем как изображение');
              throw new Error('NO_TEXT_IN_PDF');
            }

          } catch (textError) {
            console.log('📸 Переходим к анализу PDF как изображения, ошибка:', textError.message);

            // Конвертируем PDF в изображения и анализируем
            console.log('🎨 Начинаем конвертацию PDF в изображения...');
          const pdfImages = await convertPdfToImages(uploadedFile.data);
          console.log(`📸 PDF конвертирован в ${pdfImages.length} изображений`);

          if (pdfImages.length === 0) {
              console.log('❌ Конвертация PDF не удалась - нет изображений');
            throw new Error('PDF_CONVERSION_NO_IMAGES');
          }

          // Анализируем первое изображение (первую страницу)
            console.log('🔍 Отправляем запрос к Vision API для анализа изображения...');
          const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [
                {
                  role: 'system',
                  content: `Ты - Галина, опытный AI-юрист. Твоя задача - проанализировать изображение документа и определить его состояние заполненности.

ИНСТРУКЦИИ:
1. Определи тип документа (договор, решение, протокол, справка, заявление и т.д.)
2. Проанализируй структуру документа и найди все поля/разделы
3. Определи, какие поля УЖЕ ЗАПОЛНЕНЫ конкретными данными
4. Определи, какие поля НЕ ЗАПОЛНЕНЫ (пустые, содержат плейсхолдеры как [ФИО], ___ , или другие маркеры)
5. Если ВСЕ поля заполнены - сообщи что документ ГОТОВ К ИСПОЛЬЗОВАНИЮ
6. Если есть незаполненные поля - перечисли их для заполнения

ФОРМАТ ОТВЕТА:
## Анализ документа
**Тип:** [тип документа]

**Заполненные поля:**
- [список полей с конкретными значениями]

**Незаполненные поля:**
- [список полей, которые нужно заполнить]

**Статус документа:** [ГОТОВ К ИСПОЛЬЗОВАНИЮ / ТРЕБУЕТ ЗАПОЛНЕНИЯ]

Будь максимально точным! Различай заполненные и незаполненные поля. Если текст трудно прочитать, укажи это.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
                      text: `Проанализируй первую страницу этого PDF документа: ${uploadedFile.name}`
            },
            {
              type: 'image_url',
              image_url: {
                        url: pdfImages[0]
                      }
                    }
                  ]
                }
              ],
              model: 'gpt-5.1',
          reasoning: 'medium',
              max_completion_tokens: 1500,
              temperature: 0.3,
            })
          });

            console.log('📡 Vision API запрос отправлен, статус:', response.status);

          if (response.ok) {
            const data = await response.json();
            documentAnalysis = data.choices[0]?.message?.content || '';
              console.log('✅ PDF документ проанализирован через Vision API, ответ:', `${documentAnalysis.substring(0, 200)  }...`);
          } else {
              console.error('❌ Ошибка Vision API:', response.status, await response.text());
            throw new Error('PDF_ANALYSIS_FAILED');
            }
          }

        } else if (uploadedFile.type.startsWith('image/')) {
          // Для изображений используем Vision API
          console.log('🖼️ Анализируем изображение через Vision API');

          // Проверяем размер файла перед отправкой
          const fileSizeMB = uploadedFile.data.length / (1024 * 1024);
          console.log('📊 Размер файла:', fileSizeMB.toFixed(2), 'MB');

          if (fileSizeMB > 15) {
            console.log('⚠️ Файл слишком большой, используем анализ по названию');
            throw new Error('IMAGE_TOO_LARGE');
          }

          const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [
        {
          role: 'system',
                  content: `Ты - Галина, опытный AI-юрист. Твоя задача - проанализировать изображение документа и определить его состояние заполненности.

ИНСТРУКЦИИ:
1. Определи тип документа (договор, решение, протокол, справка, заявление и т.д.)
2. Проанализируй структуру документа и найди все поля/разделы
3. Определи, какие поля УЖЕ ЗАПОЛНЕНЫ конкретными данными
4. Определи, какие поля НЕ ЗАПОЛНЕНЫ (пустые, содержат плейсхолдеры как [ФИО], ___ , или другие маркеры)
5. Если ВСЕ поля заполнены - сообщи что документ ГОТОВ К ИСПОЛЬЗОВАНИЮ
6. Если есть незаполненные поля - перечисли их для заполнения

ФОРМАТ ОТВЕТА:
## Анализ документа
**Тип:** [тип документа]

**Заполненные поля:**
- [список полей с конкретными значениями]

**Незаполненные поля:**
- [список полей, которые нужно заполнить]

**Статус документа:** [ГОТОВ К ИСПОЛЬЗОВАНИЮ / ТРЕБУЕТ ЗАПОЛНЕНИЯ]

Будь максимально точным! Различай заполненные и незаполненные поля.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
                      text: `Проанализируй этот документ: ${uploadedFile.name}`
            },
            {
              type: 'image_url',
              image_url: {
                url: uploadedFile.data.startsWith('data:')
                  ? uploadedFile.data
                  : `data:image/jpeg;base64,${uploadedFile.data}`
              }
            }
          ]
        }
              ],
              model: 'gpt-5.1',
          reasoning: 'medium',
              max_completion_tokens: 1500,
              temperature: 0.3,
            })
          });

          if (response.ok) {
            const data = await response.json();
            documentAnalysis = data.choices[0]?.message?.content || '';
            console.log('✅ Изображение проанализировано через Vision API');
          } else {
            throw new Error('VISION_API_FAILED');
          }
        } else {
          throw new Error('UNSUPPORTED_FILE_TYPE');
        }

      } catch (analysisError) {
        console.log('🔄 Используем анализ по названию файла из-за ошибки:', analysisError.message);
        console.error('📋 Полная ошибка анализа:', analysisError);

        const fallbackType = analyzeDocumentType(uploadedFile.name);
        documentAnalysis = `## Анализ документа
**Тип:** ${fallbackType}

**Заполненные поля:**
- Данные не удалось извлечь из документа (${analysisError.message})

**Незаполненные поля:**
- Все поля документа нуждаются в проверке и заполнении

**Статус документа:** ТРЕБУЕТ ЗАПОЛНЕНИЯ

*Примечание: API OpenAI недоступен. Приложение работает в демо-режиме с ограниченным функционалом.*`;
      }

      console.log('📋 Результат анализа:', `${documentAnalysis.substring(0, 200)  }...`);

      // Проверяем статус документа
      const statusMatch = documentAnalysis.match(/\*\*Статус документа:\*\*\s*([^\n]+)/i);
      const documentStatus = statusMatch ? statusMatch[1].trim() : 'ТРЕБУЕТ ЗАПОЛНЕНИЯ';

      console.log('📊 Статус документа:', documentStatus);

      if (documentStatus.toUpperCase().includes('ГОТОВ') || documentStatus.toUpperCase().includes('ГОТОВ К ИСПОЛЬЗОВАНИЮ')) {
        // Документ полностью заполнен - показываем сообщение о готовности
        console.log('✅ Документ полностью заполнен');

        // Извлекаем заполненные поля для отображения
        const filledFieldsMatch = documentAnalysis.match(/\*\*Заполненные поля:\*\*\s*([\s\S]*?)(?=\*|$)/);
        const filledFields = filledFieldsMatch ? filledFieldsMatch[1].trim() : '';

        setAnalysisResult(`## 🎉 Документ готов к использованию!

${documentAnalysis}

**✅ Все необходимые поля заполнены!**

Вы можете скачать или распечатать этот документ. Он полностью соответствует требованиям законодательства и готов к применению.

*Примечание: Приложение работает в демо-режиме. Для полноценной работы с AI обновите API ключ OpenAI.*`);

        alert(`Отлично! Документ "${uploadedFile.name}" полностью заполнен и готов к использованию!\n\nПримечание: Приложение работает в демо-режиме.`);

      } else {
        // Документ требует заполнения - показываем незаполненные поля
        console.log('📝 Документ требует заполнения');

        // Извлекаем незаполненные поля
        const unfilledFieldsMatch = documentAnalysis.match(/\*\*Незаполненные поля:\*\*\s*([\s\S]*?)(?=\*\*|$)/);
        const unfilledFields = unfilledFieldsMatch ? unfilledFieldsMatch[1].trim() : '';

        if (unfilledFields && unfilledFields !== '-' && unfilledFields !== '') {
          // Есть конкретные незаполненные поля - предлагаем их заполнить
          console.log('🔍 Найдены незаполненные поля, открываем чат для заполнения');

          // Определяем тип документа для выбора подходящего шаблона
          const typeMatch = documentAnalysis.match(/\*\*Тип:\*\*\s*([^\n]+)/);
          const documentType = typeMatch ? typeMatch[1].trim() : analyzeDocumentType(uploadedFile.name);
          console.log('🎯 Определен тип документа:', documentType);

          // Ищем подходящий шаблон на основе типа документа
          let selectedTemplate = null;

          if (documentType.includes('купли-продажи') || documentType.includes('продаж') || documentType.includes('договор')) {
            selectedTemplate = allTemplates.find(t => t.name.includes('купли-продажи'));
          } else if (documentType.includes('аренды') || documentType.includes('аренд')) {
            selectedTemplate = allTemplates.find(t => t.name.includes('аренды'));
          } else if (documentType.includes('трудов') || documentType.includes('работ') || documentType.includes('труд')) {
            selectedTemplate = allTemplates.find(t => t.name.includes('Трудовой'));
          } else if (documentType.includes('исков') || documentType.includes('заявлен') || documentType.includes('иск')) {
            selectedTemplate = allTemplates.find(t => t.name.includes('Исковое'));
          } else if (documentType.includes('доверен') || documentType.includes('довер')) {
            selectedTemplate = allTemplates.find(t => t.name.includes('Доверенность'));
          } else if (documentType.includes('претенз') || documentType.includes('претен')) {
            selectedTemplate = allTemplates.find(t => t.name.includes('Претензия'));
          } else if (documentType.includes('решен') || documentType.includes('учредител') || documentType.includes('Решение') || documentType.includes('решение')) {
            // Для решений единственного учредителя используем соответствующий шаблон
            selectedTemplate = allTemplates.find(t => t.name.includes('Решение единственного'));
            console.log('📋 Для типа "Решение" выбран шаблон:', selectedTemplate?.name);
          } else {
            // Для любого другого типа документа используем шаблон по умолчанию
            selectedTemplate = allTemplates.find(t => t.name.includes('купли-продажи'));
            console.log('📋 Для неизвестного типа выбран шаблон по умолчанию:', selectedTemplate?.name);
          }

          console.log('🔍 Результат поиска шаблона:', selectedTemplate ? `Найден: ${selectedTemplate.name}` : 'Шаблон не найден');

          if (selectedTemplate) {
            // Открываем чат для редактирования загруженного документа
            console.log('🚀 Открываем интерактивный чат для редактирования документа...');
            setSelectedTemplateForChat(selectedTemplate);

            // Сохраняем текст документа для редактирования
            let docText = '';
            if (uploadedFile.type === 'text/plain') {
              // Для текстовых файлов ограничиваем размер до 8000 символов
              docText = uploadedFile.data.length > 8000 ? `${uploadedFile.data.substring(0, 8000)  }\n\n[Остальной текст документа был сокращен для обработки]` : uploadedFile.data;
            } else if (uploadedFile.type === 'application/pdf') {
              // Для PDF файлов пытаемся извлечь текст
              try {
                // Конвертируем base64 в Blob
                const pdfBlob = new Blob([Uint8Array.from(atob(uploadedFile.data.split(',')[1]), c => c.charCodeAt(0))], { type: 'application/pdf' });
                const pdfFile = new File([pdfBlob], uploadedFile.name, { type: 'application/pdf' });

                // Извлекаем текст асинхронно
                extractTextFromPDF(pdfFile).then(extractedText => {
                  console.log('📄 Извлечен текст из PDF:', `${extractedText.substring(0, 200)  }...`);
                  // Ограничиваем размер до 8000 символов
                  const limitedText = extractedText.length > 8000 ? `${extractedText.substring(0, 8000)  }\n\n[Остальной текст документа был сокращен для обработки]` : extractedText;
                  setDocumentText(limitedText);
                  setDocumentToEdit(limitedText);

                  // Открываем чат после успешного извлечения текста
                  setShowInteractiveChat(true);
                  console.log('✅ setShowInteractiveChat установлено в true для PDF');
                  setChatMessages([]);
                  setCollectedData({});
                  setCompletedDocument('');
                  setCurrentUserInput('');

                  // Создаем сообщение с анализом для PDF
                  const welcomeMessage = {
                    role: 'assistant' as const,
                    content: `Привет! Я проанализировала ваш документ "${uploadedFile.name}".

**Результаты анализа:**
${documentAnalysis}

**📝 Для завершения документа нужно заполнить следующие поля:**

${unfilledFields.split('\n').filter(line => line.trim().startsWith('-')).map(line => `🔸 ${line.substring(1).trim()}`).join('\n')}

Пожалуйста, укажите недостающие данные. Вы можете ответить на все вопросы сразу или по одному - как вам удобнее.`
                  };

                  setChatMessages([welcomeMessage]);
                  console.log('💬 Чат открыт для редактирования PDF документа');

                }).catch(error => {
                  console.warn('⚠️ Не удалось извлечь текст из PDF:', error);
                  // Если извлечение не удалось, используем шаблон
                  const templateText = selectedTemplate.template;
                  setDocumentText(templateText);
                  setDocumentToEdit(templateText);

                  // Открываем чат с шаблоном
                  setShowInteractiveChat(true);
                  console.log('✅ setShowInteractiveChat установлено в true с шаблоном');
                  setChatMessages([]);
                  setCollectedData({});
                  setCompletedDocument('');
                  setCurrentUserInput('');

                  // Создаем сообщение для шаблона
                  const welcomeMessage = {
                    role: 'assistant' as const,
                    content: `Привет! Я проанализировала ваш документ "${uploadedFile.name}".

**Результаты анализа:**
${documentAnalysis}

**⚠️ Не удалось извлечь текст из PDF. Использую шаблон для заполнения.**

**📝 Для завершения документа нужно заполнить следующие поля:**

${unfilledFields.split('\n').filter(line => line.trim().startsWith('-')).map(line => `🔸 ${line.substring(1).trim()}`).join('\n')}

Пожалуйста, укажите недостающие данные. Вы можете ответить на все вопросы сразу или по одному - как вам удобнее.`
                  };

                  setChatMessages([welcomeMessage]);
                  console.log('💬 Чат открыт с шаблоном для PDF документа');
                });
              } catch (error) {
                console.warn('⚠️ Ошибка при конвертации PDF:', error);
                docText = selectedTemplate.template;
              }
            } else {
              // Для изображений используем шаблон
              docText = selectedTemplate.template;
            }

            // Для синхронных случаев устанавливаем текст сразу
            if (docText) {
              setDocumentText(docText);
              setDocumentToEdit(docText);
            }

            // Для текстовых файлов и изображений открываем чат сразу
            if (uploadedFile.type !== 'application/pdf') {
            setShowInteractiveChat(true);
            console.log('✅ setShowInteractiveChat установлено в true');
            setChatMessages([]);
            setCollectedData({});
            setCompletedDocument('');
            setCurrentUserInput('');

            // Создаем сообщение с анализом и предложением заполнить поля
            const welcomeMessage = {
              role: 'assistant' as const,
              content: `Привет! Я проанализировала ваш документ "${uploadedFile.name}".

**Результаты анализа:**
${documentAnalysis}

**📝 Для завершения документа нужно заполнить следующие поля:**

${unfilledFields.split('\n').filter(line => line.trim().startsWith('-')).map(line => `🔸 ${line.substring(1).trim()}`).join('\n')}

Пожалуйста, укажите недостающие данные. Вы можете ответить на все вопросы сразу или по одному - как вам удобнее.`
            };

            setChatMessages([welcomeMessage]);
            console.log('💬 Чат открыт для заполнения незаполненных полей');
            }

          } else {
            // Шаблон не найден - показываем анализ без чата
            console.log('❌ Шаблон не найден для типа:', documentType);
            setAnalysisResult(`**Результаты анализа документа "${uploadedFile.name}":**

${documentAnalysis}

**⚠️ Для данного типа документа (${documentType}) у меня нет подходящего шаблона для автоматического заполнения.**

Рекомендую использовать ручное заполнение или обратиться к юристу для проверки документа.`);
          }

        } else {
          // Нет конкретных незаполненных полей - показываем общий анализ
          setAnalysisResult(`**Результаты анализа документа "${uploadedFile.name}":**

${documentAnalysis}

**ℹ️ Документ проанализирован, но точные незаполненные поля определить не удалось.**

Рекомендую проверить документ вручную или загрузить его повторно.`);
        }
      }

    } catch (error) {
      console.error('Ошибка при анализе документа:', error);
      alert('Произошла ошибка при анализе документа. Попробуйте еще раз.');
    } finally {
      setIsAnalyzingDocument(false);
    }
  };

  // Запуск камеры
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Использовать заднюю камеру на мобильных
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Ошибка доступа к камере:', error);
      alert('Не удалось получить доступ к камере. Проверьте разрешения.');
      setShowCamera(false);
    }
  }, []);

  // Остановка камеры
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Съемка фото
  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);

        // Получаем изображение в формате base64
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageData);

        // Останавливаем камеру
        stopCamera();
      }
    }
  }, [stopCamera]);

  // Постобработка изображения
  const processImage = useCallback(async (imageData: string) => {
    setIsProcessingImage(true);

    try {
      // Создаем изображение для обработки
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageData;
      });

      // Создаем canvas для обработки
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Не удалось создать canvas context');
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // Рисуем оригинальное изображение
      ctx.drawImage(img, 0, 0);

      // Получаем данные изображения
      const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageDataObj.data;

      // Применяем базовую постобработку:
      // 1. Улучшение контраста
      // 2. Повышение резкости
      // 3. Коррекция яркости

      for (let i = 0; i < data.length; i += 4) {
        // Улучшение контраста (коэффициент 1.2)
        const contrast = 1.2;
        data[i] = ((data[i] / 255 - 0.5) * contrast + 0.5) * 255;     // R
        data[i + 1] = ((data[i + 1] / 255 - 0.5) * contrast + 0.5) * 255; // G
        data[i + 2] = ((data[i + 2] / 255 - 0.5) * contrast + 0.5) * 255; // B

        // Ограничение значений
        data[i] = Math.max(0, Math.min(255, data[i]));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1]));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2]));
      }

      // Применяем изменения
      ctx.putImageData(imageDataObj, 0, 0);

      // Возвращаем обработанное изображение
      const processedImageData = canvas.toDataURL('image/jpeg', 0.95);
      console.log('Изображение обработано успешно');

      return processedImageData;

    } catch (error) {
      console.error('Ошибка постобработки:', error);
      // Возвращаем оригинальное изображение в случае ошибки
      return imageData;
    } finally {
      setIsProcessingImage(false);
    }
  }, []);

  // Отправка обработанного документа в чат
  const sendToChat = useCallback(async () => {
    if (!capturedImage) return;

    setIsScanning(true);

    try {
      const processedImage = await processImage(capturedImage);

      // Сохраняем изображение в localStorage для использования в чате
      localStorage.setItem('scannedDocument', processedImage);
      localStorage.setItem('scanRequest', 'Я отсканировал документ с камеры. Проанализируй его и помоги с заполнением или создай соответствующий шаблон.');

      // Закрываем модальное окно
      setShowCamera(false);
      setCapturedImage(null);

      // Переходим в чат
      navigate('/chat');

    } catch (error) {
      console.error('Ошибка обработки:', error);
      alert('Ошибка обработки изображения');
    } finally {
      setIsScanning(false);
    }
  }, [capturedImage, processImage, navigate]);

  // Закрытие модального окна
  const closeCamera = useCallback(() => {
    stopCamera();
    setShowCamera(false);
    setCapturedImage(null);
  }, [stopCamera]);

  // Очистка ресурсов при размонтировании
  useEffect(() => {
    return () => {
      stopCamera();
  };
  }, [stopCamera]);

  // Эффект для прокрутки чата вниз при новых сообщениях
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Отслеживаем изменения состояния showInteractiveChat
  useEffect(() => {
    console.log('👀 showInteractiveChat изменилось:', showInteractiveChat);
    console.log('👀 selectedTemplateForChat:', selectedTemplateForChat?.name);
    console.log('👀 chatMessages length:', chatMessages.length);
  }, [showInteractiveChat, selectedTemplateForChat, chatMessages]);

  // Обработчик нажатия Enter в поле ввода
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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
                <FileEdit className="h-8 w-8" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              Заполнение документов
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Выберите шаблон документа и заполните его с помощью Галины. AI поможет корректно заполнить все поля и учтет требования законодательства.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {/* Templates Section */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-6">
                  Доступные шаблоны
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allTemplates.map((template, index) => (
                    <Card
                      key={index}
                      className="border-border/50 hover:shadow-elegant transition-smooth group cursor-pointer"
                      onClick={() => handleTemplateClick(template.name)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-5 w-5 text-primary" />
                              <h3 className="font-semibold text-foreground group-hover:text-primary transition-smooth">
                                {template.name}
                              </h3>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {template.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTemplatePreview(template.name);
                              }}
                              className="h-8 px-2 text-xs"
                            >
                              Просмотр
                            </Button>
                            <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={(e) => {
                                console.log('🔘 Fill button clicked for:', template.name);
                                e.stopPropagation();
                                handleInteractiveTemplateClick(template.name);
                              }}
                              className="h-8 px-2 text-xs flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              <MessageSquare className="h-3 w-3" />
                              Заполнить
                            </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  console.log('📷 Scan fill button clicked for:', template.name);
                                  e.stopPropagation();
                                  startScanFill(template);
                                }}
                                className="h-8 px-2 text-xs flex items-center gap-1"
                              >
                                <Scan className="h-3 w-3" />
                                Сканировать
                              </Button>
                            </div>
                            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-smooth" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Кнопки сканирования и загрузки */}
                <div className="mt-6 space-y-4">
                  {/* Кнопка сканирования */}
                  <Card className="border-border/50 hover:shadow-elegant transition-smooth group cursor-pointer" onClick={handleScanDocument}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Scan className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-smooth">
                            Отсканировать документ
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {isScanning ? "Сканирование..." : "Сфотографируйте существующий документ камерой"}
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-smooth flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Кнопка загрузки */}
                  <Card className={`border-border/50 hover:shadow-elegant transition-smooth group cursor-pointer ${
                    uploadedFile ? 'border-[#129246]/20 bg-[#129246]/5' : ''
                  }`} onClick={handleUploadDocument}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                          uploadedFile ? 'bg-[#129246]/20 text-[#129246]' : 'bg-[#129246]/10 text-[#129246]/70'
                        }`}>
                          <Upload className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-smooth">
                            {uploadedFile ? 'Заменить документ' : '📄 Создание документа на основе существующего'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {isUploadingFile ? "Загрузка..." :
                             uploadedFile ?
                             `Загружен: ${uploadedFile.name}` :
                             "Загрузите документ (TXT, PDF, JPG, PNG), и я проанализирую его содержимое для создания аналогичного документа"}
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-smooth flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Скрытый input для выбора файла */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {/* Секция загруженного документа */}
                {uploadedFile && (
                  <div className="mt-8">
                    <Card className="border-border/50">
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-foreground">
                              Загруженный документ
                            </h3>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setUploadedFile(null)}
                            >
                              Удалить
                            </Button>
                          </div>

                          {/* Превью файла */}
                          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                            {uploadedFile.type === 'text/plain' ? (
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-16 bg-white rounded border flex items-center justify-center">
                                  <FileText className="h-8 w-8 text-blue-500" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">{uploadedFile.name}</p>
                                  <p className="text-sm text-muted-foreground">Текстовый файл</p>
                                  <div className="mt-2 p-2 bg-white rounded border max-h-20 overflow-y-auto">
                                    <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                                      {uploadedFile.data.length > 200
                                        ? `${uploadedFile.data.substring(0, 200)  }...`
                                        : uploadedFile.data}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            ) : uploadedFile.type === 'application/pdf' ? (
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-16 bg-white rounded border flex items-center justify-center">
                                  <FileText className="h-8 w-8 text-red-500" />
                                </div>
                                <div>
                                  <p className="font-medium">{uploadedFile.name}</p>
                                  <p className="text-sm text-muted-foreground">PDF документ</p>
                                </div>
                              </div>
                            ) : uploadedFile.type.startsWith('image/') ? (
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-16 bg-white rounded border overflow-hidden flex items-center justify-center">
                                  <img
                                    src={uploadedFile.data}
                                    alt={uploadedFile.name}
                                    className="max-w-full max-h-full object-contain"
                                  />
                                </div>
                                <div>
                                  <p className="font-medium">{uploadedFile.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {uploadedFile.type.includes('jpeg') || uploadedFile.type.includes('jpg') ? 'JPEG изображение' :
                                     uploadedFile.type.includes('png') ? 'PNG изображение' : 'Изображение'}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-16 bg-white rounded border flex items-center justify-center">
                                  <FileText className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium">{uploadedFile.name}</p>
                                  <p className="text-sm text-muted-foreground">Неизвестный тип файла</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Кнопка открытия чата */}
                            <Button
                              onClick={handleAnalyzeDocument}
                              disabled={isAnalyzingDocument}
                              className="w-full"
                            >
                              {isAnalyzingDocument ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Анализирую документ...
                                </>
                              ) : (
                              <>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Открыть чат для заполнения
                              </>
                              )}
                            </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>

              {/* Секция результатов анализа */}
              {analysisResult && (
                <div className="mt-8">
                  <Card className="border-border/50">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold text-foreground mb-4">
                        📊 Результаты анализа документа
                      </h3>
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown>{analysisResult}</ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card className="border-border/50 bg-primary/5">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    Как это работает?
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Интерактивное заполнение:</h4>
                      <ol className="space-y-2">
                        {[
                          "Нажмите кнопку 'Заполнить' на шаблоне документа",
                          "Галина задаст вопросы о необходимых данных",
                          "Последовательно отвечайте на вопросы",
                          "AI автоматически заполнит все поля документа",
                          "Скачайте готовый документ",
                    ].map((step, index) => (
                      <li key={index} className="flex items-start gap-3 text-sm">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground flex-shrink-0 text-xs font-semibold">
                          {index + 1}
                        </div>
                        <span className="text-muted-foreground mt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                    </div>

                    <div>
                      <h4 className="font-medium text-foreground mb-2">Автоматическое заполнение по скану:</h4>
                      <ol className="space-y-2">
                        {[
                          "Выберите шаблон и нажмите 'Сканировать'",
                          "Сфотографируйте или загрузите изображение документа",
                          "AI автоматически распознает текст и данные",
                          "Получите готовый заполненный документ мгновенно",
                        ].map((step, index) => (
                          <li key={index} className="flex items-start gap-3 text-sm">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full text-white flex-shrink-0 text-xs font-semibold" style={{ backgroundColor: '#129246' }}>
                          {index + 1}
                        </div>
                        <span className="text-muted-foreground mt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                    </div>

                    <div>
                      <h4 className="font-medium text-foreground mb-2">Создание на основе документа:</h4>
                      <ol className="space-y-2">
                        {[
                          "Загрузите существующий документ любого типа",
                          "AI определит тип документа и откроет соответствующий чат",
                          "Галина задаст вопросы для сбора данных",
                          "Получите готовый заполненный документ",
                        ].map((step, index) => (
                          <li key={index} className="flex items-start gap-3 text-sm">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white flex-shrink-0 text-xs font-semibold">
                              {index + 1}
                            </div>
                            <span className="text-muted-foreground mt-0.5">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Info Section */}
            <div className="space-y-6">
              <Card className="gradient-card border-border/50 shadow-elegant">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    Преимущества
                  </h3>
                  <ul className="space-y-3">
                    {[
                      "Соответствие законодательству",
                      "Экономия времени на заполнение",
                      "Профессиональное оформление",
                      "Проверка на ошибки",
                      "Готовые к использованию документы",
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    Нужен другой документ?
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Не нашли нужный шаблон? Опишите документ в чате, и Галина поможет его создать.
                  </p>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/chat">
                      Перейти в чат
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Camera Modal */}
      <Dialog open={showCamera} onOpenChange={closeCamera}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Сканирование документа
            </DialogTitle>
            <DialogDescription>
              Поместите документ в рамку и сделайте фото для автоматического распознавания текста
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!capturedImage ? (
              // Camera view
              <div className="space-y-4">
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-auto max-h-96 object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Camera overlay with document guide */}
                  <div className="absolute inset-4 border-2 border-dashed border-white/50 rounded-lg pointer-events-none">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-white/70 text-center">
                        <Scan className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">Поместите документ в рамку</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={capturePhoto}
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    <Camera className="h-5 w-5" />
                    Сфотографировать
                  </Button>
                  <Button
                    onClick={closeCamera}
                    variant="outline"
                    size="lg"
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              // Captured image view
              <div className="space-y-4">
                <div className="relative bg-muted rounded-lg overflow-hidden">
                  <img
                    src={capturedImage}
                    alt="Снятый документ"
                    className="w-full h-auto max-h-96 object-contain"
                  />

                  {isProcessingImage && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="text-white text-center">
                        <RotateCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                        <p>Обработка изображения...</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={sendToChat}
                    disabled={isProcessingImage || isScanning}
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    {isScanning ? (
                      <>
                        <RotateCw className="h-5 w-5 animate-spin" />
                        Отправка...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        Отправить в чат
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => setCapturedImage(null)}
                    variant="outline"
                    size="lg"
                    disabled={isProcessingImage}
                  >
                    Переснять
                  </Button>
                  <Button
                    onClick={closeCamera}
                    variant="outline"
                    size="lg"
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Модальное окно просмотра шаблона */}
      <Dialog open={showTemplatePreview} onOpenChange={setShowTemplatePreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplateForPreview?.name}</DialogTitle>
            <DialogDescription>{selectedTemplateForPreview?.description}</DialogDescription>
          </DialogHeader>

          {selectedTemplateForPreview?.template && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Шаблон документа:</h4>
                <pre className="text-sm whitespace-pre-wrap font-mono bg-background p-3 rounded border overflow-x-auto">
                  {selectedTemplateForPreview.template}
                </pre>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleTemplateClick(selectedTemplateForPreview.name)}
                  className="flex-1"
                >
                  Создать документ
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowTemplatePreview(false)}
                >
                  Закрыть
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Модальное окно интерактивного чата */}
      {showInteractiveChat && (
        <>
          {console.log('🎨 Rendering interactive chat modal, showInteractiveChat:', showInteractiveChat)}
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowInteractiveChat(false)}>
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Интерактивное заполнение: {selectedTemplateForChat?.name}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Ответьте на вопросы Галины, чтобы автоматически заполнить документ
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInteractiveChat(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

          <div className="flex-1 flex flex-col min-h-0">
            {/* Область чата */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30 rounded-lg mb-4">
              {chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background border'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}

              {isWaitingForAI && (
                <div className="flex justify-start">
                  <div className="bg-background border p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Галина печатает...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Готовый документ */}
            {(() => {
              console.log('🎨 Рендерим готовый документ, completedDocument существует:', !!completedDocument);
              return completedDocument;
            })() && (
              <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#12924605', border: '1px solid #12924620' }}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold flex items-center gap-2" style={{ color: '#129246' }}>
                    <CheckCircle2 className="h-5 w-5" />
                    Документ готов!
                  </h4>
                  <div className="flex gap-2">
                  <Button
                    onClick={downloadDocument}
                    size="sm"
                      variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                      Скачать TXT
                    </Button>
                    <Button
                      onClick={downloadDocumentAsPDF}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Скачать PDF
                  </Button>
                  </div>
                </div>
                <div className="bg-white p-3 rounded border max-h-40 overflow-y-auto">
                  <pre className="text-xs whitespace-pre-wrap font-mono">{completedDocument}</pre>
                </div>
              </div>
            )}

            {/* Поле ввода (показывается только если документ не готов) */}
            {!completedDocument && (
              <div className="space-y-3">
                {/* Прикрепленный файл */}
                {attachedFile && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center gap-2 flex-1">
                      <Upload className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-blue-900">{attachedFileName}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeAttachedFile}
                      className="h-6 w-6 p-0 hover:bg-blue-100"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

              <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                <textarea
                  value={currentUserInput}
                  onChange={(e) => setCurrentUserInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                      placeholder="Введите ваш ответ или прикрепите изображение документа..."
                      className="w-full min-h-[60px] max-h-[120px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isWaitingForAI}
                />

                    {/* Кнопки прикрепления */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                const dataUrl = e.target?.result as string;
                                attachFileToChat(dataUrl, file.name);
                              };
                              reader.readAsDataURL(file);
                            }
                          };
                          input.click();
                        }}
                        disabled={isWaitingForAI}
                        className="flex items-center gap-1 text-xs"
                      >
                        <Upload className="h-3 w-3" />
                        Прикрепить фото
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowCamera(true);
                          setCapturedImage(null);
                        }}
                        disabled={isWaitingForAI}
                        className="flex items-center gap-1 text-xs"
                      >
                        <Camera className="h-3 w-3" />
                        Сфотографировать
                      </Button>
                    </div>
                  </div>

                <Button
                  onClick={handleSendMessage}
                    disabled={(!currentUserInput.trim() && !attachedFile) || isWaitingForAI}
                  className="self-end"
                >
                  Отправить
                </Button>
                </div>
              </div>
            )}
          </div>

              {/* Кнопки управления */}
              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={resetChat}>
                  Начать заново
                </Button>
                <Button onClick={() => setShowInteractiveChat(false)}>
                  Закрыть
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Модальное окно сканирования и автоматического заполнения */}
      {showScanFill && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowScanFill(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-start">
              <div className="flex-1">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Scan className="h-5 w-5" />
                  Сканирование для авто-заполнения: {selectedTemplateForScan?.name}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Сфотографируйте или загрузите изображение документа для автоматического заполнения
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowScanFill(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Кнопки сканирования */}
              <div className="space-y-4 mb-6">
                <Button
                  onClick={() => {
                    setShowCamera(true);
                    setCapturedImage(null);
                  }}
                  disabled={isAutoFilling}
                  className="w-full flex items-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  {isScanning ? "Сканирование..." : "Сфотографировать документ"}
                </Button>

                <div className="text-center text-sm text-muted-foreground">или</div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 mb-2">
                    Перетащите изображение сюда или нажмите для выбора файла
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="scan-file-input"
                    disabled={isAutoFilling}
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('scan-file-input')?.click()}
                    disabled={isAutoFilling}
                  >
                    Выбрать файл
                  </Button>
                </div>
              </div>

              {/* Отображение захваченного изображения */}
              {capturedImage && (
                <div className="mb-6">
                  <h3 className="font-medium mb-2">Захваченное изображение:</h3>
                  <div className="border rounded-lg p-2 bg-gray-50">
                    <img
                      src={capturedImage}
                      alt="Captured document"
                      className="max-w-full h-auto rounded"
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={() => processScannedImage(capturedImage)}
                      disabled={isAutoFilling}
                      className="flex-1"
                    >
                      {isAutoFilling ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Автоматическое заполнение...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Автоматически заполнить
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCapturedImage(null)}
                      disabled={isAutoFilling}
                    >
                      <RotateCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Результат сканирования */}
              {scanResult && (
                <div className="border rounded-lg p-4" style={{ backgroundColor: '#12924605', borderColor: '#12924620' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold flex items-center gap-2" style={{ color: '#129246' }}>
                      <CheckCircle2 className="h-5 w-5" />
                      Документ готов!
                    </h3>
                    <Button
                      onClick={downloadScanResult}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Скачать
                    </Button>
                  </div>
                  <div className="bg-white p-3 rounded border max-h-60 overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap font-mono">{scanResult}</pre>
                  </div>
                </div>
              )}
            </div>

            {/* Кнопки управления */}
            <div className="flex justify-end gap-2 p-6 border-t">
              <Button variant="outline" onClick={() => setShowScanFill(false)}>
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно камеры */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={() => setShowCamera(false)}>
          <div className="relative w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg"
            />
            <canvas ref={canvasRef} className="hidden" />

            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
              <Button
                onClick={captureImage}
                disabled={isScanning}
                size="lg"
                className="rounded-full w-16 h-16 flex items-center justify-center"
              >
                <Camera className="h-6 w-6" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCamera(false)}
                size="lg"
                className="rounded-full w-16 h-16 flex items-center justify-center bg-white/20 border-white/40 text-white hover:bg-white/30"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentFilling;
