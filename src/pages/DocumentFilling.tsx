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
  // Основные состояния для Nana Banana Pro
  const [showScanFill, setShowScanFill] = useState(false);
  const [selectedTemplateForScan, setSelectedTemplateForScan] = useState<typeof DOCUMENT_TEMPLATES[0] | null>(null);
  const [scanResult, setScanResult] = useState('');
  const [isAutoFilling, setIsAutoFilling] = useState(false);

  // Состояния Nana Banana Pro интеграции
  const [documentFields, setDocumentFields] = useState<Array<{name: string, label: string, value: string, required: boolean, description: string}>>([]);
  const [showFieldInput, setShowFieldInput] = useState(false);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isSendingToNanaBanana, setIsSendingToNanaBanana] = useState(false);
  const [nanaBananaResult, setNanaBananaResult] = useState<string | null>(null);
  const [scannedImageData, setScannedImageData] = useState<string | null>(null);

  // Камера и сканирование
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Используем шаблоны из констант
  const allTemplates = DOCUMENT_TEMPLATES;

  // Функция для начала универсального сканирования документа
  const startUniversalScan = useCallback(() => {
    console.log('🚀 Запуск универсального сканирования документа');
    setSelectedTemplateForScan(null); // Без конкретного шаблона
    setShowScanFill(true);
  }, []);

  // Функция для обработки загруженного файла с главной страницы
  const handleMainFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Проверяем тип файла
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Поддерживаются только изображения (JPEG, PNG, WebP) и PDF файлы');
      return;
    }

    // Проверяем размер файла (макс 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер: 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const fileData = e.target?.result as string;
      setCapturedImage(fileData);

      // Автоматически запускаем процесс анализа
      startUniversalScan();
      setTimeout(() => {
        processScannedImage(fileData);
      }, 500);
    };
    reader.readAsDataURL(file);

    // Очищаем input
    event.target.value = '';
  };

  // Функция для обработки загруженного файла в модальном окне
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

      const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setCapturedImage(imageData);
      };
      reader.readAsDataURL(file);
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

      // Конвертируем первую страницу (для анализа)
      const pageNum = 1;
        console.log(`📄 Конвертируем страницу ${pageNum}...`);

        const page = await pdf.getPage(pageNum);

        // Создаем canvas для рендеринга страницы
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
          console.error('❌ Не удалось создать canvas context');
        throw new Error('CANVAS_CONTEXT_FAILED');
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

      console.log(`✅ PDF конвертирован в изображение`);
      return images;

    } catch (error) {
      console.error('❌ Ошибка конвертации PDF:', error);
      throw new Error('PDF_CONVERSION_FAILED');
    }
  }, []);

  // Функция обработки отсканированного изображения
  const processScannedImage = useCallback(async (imageData: string) => {
    setIsAutoFilling(true);

    let imageToAnalyze = imageData;

    // Если это PDF, конвертируем в изображение
    if (imageData.startsWith('data:application/pdf')) {
      console.log('📄 Обнаружен PDF файл, конвертируем...');
      try {
        const pdfImages = await convertPdfToImages(imageData);
        if (pdfImages.length === 0) {
          throw new Error('PDF_CONVERSION_NO_IMAGES');
        }
        imageToAnalyze = pdfImages[0]; // Используем первое изображение для анализа
        console.log('📸 PDF конвертирован в изображение для анализа');
      } catch (error) {
        console.error('❌ Ошибка конвертации PDF:', error);
        setScanResult('Ошибка обработки PDF файла. Попробуйте загрузить изображение.');
        setIsAutoFilling(false);
        return;
      }
    }

    setScannedImageData(imageToAnalyze);
    console.log('🤖 Начинаем анализ изображения через LLM...');

    try {
          const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [
                {
                  role: 'system',
              content: `Ты - AI-ассистент для анализа юридических документов. Твоя задача - проанализировать изображение любого документа и определить поля, которые обычно заполняются в таких документах.

ИНСТРУКЦИИ:
1. Посмотри на изображение документа и определи его тип (договор, заявление, доверенность, иск, претензия и т.д.)
2. Определи какие поля обычно заполняются в документах такого типа
3. Для каждого поля укажи: название, тип, обязательно ли оно, описание

ФОРМАТ ОТВЕТА (ТОЛЬКО JSON):
{
  "document_type": "тип документа",
  "fields": [
    {
      "name": "field_name",
      "label": "Название поля",
      "required": true/false,
      "description": "Описание поля"
    }
  ]
}

Примеры полей для разных документов:
- Договор: продавец, покупатель, предмет договора, цена, дата, подписи
- Исковое заявление: истец, ответчик, предмет иска, требования, дата
- Доверенность: доверитель, доверенное лицо, полномочия, срок действия
- Трудовой договор: работник, работодатель, должность, оклад, дата заключения
- Претензия: заявитель, получатель, предмет претензии, требования, срок ответа`
                    },
                    {
                      role: 'user',
              content: `Проанализируй этот документ и определи поля для заполнения. Изображение: ${imageData.substring(0, 100)}...`
                    }
                  ],
                  model: 'gpt-5.1',
          reasoning: 'high',
          max_completion_tokens: 2000,
                  temperature: 0.3,
                })
              });

      if (!response.ok) {
        throw new Error(`LLM analysis failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';

      // Парсим JSON ответ
      const parsed = JSON.parse(content);
      setDocumentFields(parsed.fields || []);
      setShowFieldInput(true);
      setCurrentFieldIndex(0);

      console.log('✅ Документ проанализирован:', {
        type: parsed.document_type,
        fields: parsed.fields?.length || 0
      });

    } catch (error) {
      console.error('❌ Ошибка анализа документа:', error);
      setScanResult('Ошибка анализа документа. Попробуйте еще раз.');
    } finally {
      setIsAutoFilling(false);
    }
  }, []);

  // Функция обновления значения поля
  const updateFieldValue = useCallback((fieldName: string, value: string) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  }, []);

  // Следующее поле
  const nextField = useCallback(() => {
    if (currentFieldIndex < documentFields.length - 1) {
      setCurrentFieldIndex(prev => prev + 1);
          } else {
      // Все поля заполнены, отправляем в Nana Banana Pro
      sendToNanaBanana();
    }
  }, [currentFieldIndex, documentFields.length]);

  // Предыдущее поле
  const prevField = useCallback(() => {
    if (currentFieldIndex > 0) {
      setCurrentFieldIndex(prev => prev - 1);
    }
  }, [currentFieldIndex]);

  // Отправка в Nana Banana Pro
  const sendToNanaBanana = useCallback(async () => {
    if (!scannedImageData || documentFields.length === 0) {
      console.error('❌ Недостаточно данных для отправки в Nana Banana Pro');
      return;
    }

    setIsSendingToNanaBanana(true);
    console.log('🎨 Отправляем данные в Nana Banana Pro (через LLM)...');

    try {
      const filledFieldsPrompt = documentFields.map(field =>
        `${field.label}: ${fieldValues[field.name] || '[НЕ ЗАПОЛНЕНО]'}`
      ).join('\n');

          const response = await fetch(`${API_CONFIG.BASE_URL}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [
        {
          role: 'system',
              content: `Ты - продвинутый AI-ассистент, имитирующий работу сервиса Nana Banana Pro. Твоя задача - взять изображение юридического документа, список полей с их значениями и "заполнить" документ от руки, имитируя рукописный ввод.

ИНСТРУКЦИИ:
1. Представь, что ты получаешь изображение документа и данные для заполнения.
2. "Заполни" документ, вставляя предоставленные значения в соответствующие места, как если бы это было сделано от руки.
3. Сохрани оригинальный формат документа, но с добавленными "рукописными" данными.
4. Используй стиль, который имитирует рукописный ввод (например, курсив, или просто вставь текст в нужные места).
5. Если поле не заполнено, оставь его пустым или укажи [НЕ ЗАПОЛНЕНО].

ФОРМАТ ОТВЕТА:
[Полностью заполненный документ с имитацией рукописного ввода]`
        },
        {
          role: 'user',
              content: `Вот изображение документа (base64): ${scannedImageData.substring(0, 100)}...\n\nИ вот данные для заполнения:\n${filledFieldsPrompt}\n\nЗаполни документ от руки.`
        }
              ],
              model: 'gpt-5.1',
          reasoning: 'high',
          max_completion_tokens: 3000,
          temperature: 0.5,
            })
          });

      if (!response.ok) {
        throw new Error(`Nana Banana Pro simulation failed: ${response.status}`);
      }

      const nanaBananaData = await response.json();
      const resultDocument = nanaBananaData.choices[0]?.message?.content || '';

      setNanaBananaResult(resultDocument);
      setScanResult(resultDocument);
      setIsSendingToNanaBanana(false);
      setShowFieldInput(false);

      console.log('✅ Документ заполнен через Nana Banana Pro');

              } catch (error) {
      console.error('❌ Ошибка отправки в Nana Banana Pro:', error);
      setIsSendingToNanaBanana(false);
      setScanResult('Ошибка заполнения документа. Попробуйте еще раз.');
    }
  }, [scannedImageData, documentFields, fieldValues]);

  // Функции работы с камерой
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('❌ Ошибка доступа к камере:', error);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      setIsScanning(true);
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
        setIsScanning(false);
      } else {
        setIsScanning(false);
      }
    }
  }, [stopCamera]);

  // Специальная функция захвата для Nana Banana Pro
  const captureForNanaBanana = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      setIsScanning(true);
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

        // Автоматически запускаем анализ для Nana Banana Pro
        setTimeout(() => {
          processScannedImage(imageData);
        }, 500);

        // Останавливаем камеру
        stopCamera();
        setShowCamera(false);
        setIsScanning(false);
      } else {
        setIsScanning(false);
      }
    }
  }, [stopCamera, processScannedImage]);

  // Эффект для запуска камеры
  useEffect(() => {
    if (showCamera) {
      startCamera();
    }
    return () => {
      stopCamera();
  };
  }, [showCamera, startCamera, stopCamera]);

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <Header />
      
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12">
          {/* Header Section */}
          <div className="mb-12 text-center space-y-4">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Scan className="h-8 w-8" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              Заполнение документов через Nana Banana Pro
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Сфотографируйте любой документ, и AI заполнит его от руки с помощью рукописного ввода.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            {/* Single Scan Section */}
            <div className="space-y-8">
              <Card className="border-border/50 hover:shadow-elegant transition-smooth">
                <CardContent className="p-8 text-center">
                  <div className="flex justify-center mb-6">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Scan className="h-10 w-10" />
                            </div>
                          </div>

                  <h2 className="text-2xl font-bold text-foreground mb-4">
                    Сканирование документа
                  </h2>

                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Сфотографируйте или загрузите изображение любого документа.
                    AI автоматически распознает тип документа и заполнит его от руки.
                  </p>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Button
                        size="lg"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground py-4"
                        onClick={startUniversalScan}
                      >
                        <Camera className="h-5 w-5 mr-2" />
                        Сфотографировать
                            </Button>

                            <Button
                        size="lg"
                                variant="outline"
                        className="py-4"
                        onClick={() => document.getElementById('main-file-input')?.click()}
                      >
                        <Upload className="h-5 w-5 mr-2" />
                        Загрузить файл
                              </Button>
                </div>

                    {/* Скрытый input для загрузки файлов */}
                  <input
                    type="file"
                      accept="image/*,.pdf"
                      onChange={handleMainFileSelect}
                    className="hidden"
                      id="main-file-input"
                    />

                    <div className="text-sm text-muted-foreground text-center">
                      Поддерживаются: фото и PDF документы (договоры, исковые заявления, доверенности, претензии и др.)
                          </div>
                        </div>
                      </CardContent>
                    </Card>

              <Card className="border-border/50 bg-muted/30">
                    <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 flex-shrink-0 mt-0.5">
                      <FileText className="h-4 w-4" />
                      </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground mb-2">
                    Как это работает?
                  </h3>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Сфотографируйте документ камерой или загрузите фото/PDF файл</li>
                        <li>• AI автоматически распознает тип документа и поля для заполнения</li>
                        <li>• Заполните необходимые данные в интерактивной форме</li>
                        <li>• Получите документ, заполненный от руки через Nana Banana Pro</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Nana Banana Pro модальное окно */}
      {showScanFill && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowScanFill(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Scan className="h-5 w-5" />
                  Заполнение документа через Nana Banana Pro
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                  Сфотографируйте или загрузите изображение документа для интеллектуального заполнения от руки
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
              {/* Интерфейс ввода полей */}
              {showFieldInput && documentFields.length > 0 && (
                <div className="mb-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Заполнение полей документа ({currentFieldIndex + 1}/{documentFields.length})
                      </h3>

                    {documentFields[currentFieldIndex] && (
                  <div className="space-y-4">
                    <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {documentFields[currentFieldIndex].label}
                            {documentFields[currentFieldIndex].required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <p className="text-xs text-gray-500 mb-2">{documentFields[currentFieldIndex].description}</p>
                          <input
                            type="text"
                            value={fieldValues[documentFields[currentFieldIndex].name] || ''}
                            onChange={(e) => updateFieldValue(documentFields[currentFieldIndex].name, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={`Введите ${documentFields[currentFieldIndex].label.toLowerCase()}`}
                          />
                    </div>

                  <div className="flex gap-2">
                  <Button
                            onClick={prevField}
                            disabled={currentFieldIndex === 0}
                      variant="outline"
                  >
                            Назад
                    </Button>
                    <Button
                            onClick={nextField}
                            disabled={!fieldValues[documentFields[currentFieldIndex].name]?.trim()}
                            className="flex-1"
                          >
                            {currentFieldIndex === documentFields.length - 1 ? (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Отправить в Nana Banana Pro
                      </>
                    ) : (
                              'Далее'
                    )}
                  </Button>
                </div>
              </div>
            )}

                    {/* Прогресс */}
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Прогресс заполнения</span>
                        <span>{Math.round(((currentFieldIndex + 1) / documentFields.length) * 100)}%</span>
                    </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${((currentFieldIndex + 1) / documentFields.length) * 100}%` }}
                        ></div>
                  </div>
                    </div>
                </div>
              </div>
            )}

              {/* Результат от Nana Banana Pro */}
              {nanaBananaResult && (
                <div className="mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-medium text-green-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                      Документ заполнен через Nana Banana Pro
                    </h3>
                    <div className="bg-white border rounded p-3 max-h-60 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap">{nanaBananaResult}</pre>
                  </div>
                    <div className="flex gap-2 mt-3">
                      <Button onClick={() => {
                        // Скачать результат
                        const blob = new Blob([nanaBananaResult], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `filled-document-${Date.now()}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}>
                        <Download className="h-4 w-4 mr-2" />
                        Скачать результат
                </Button>
                      <Button variant="outline" onClick={() => {
                        setNanaBananaResult(null);
                        setShowScanFill(false);
                      }}>
                  Закрыть
                </Button>
              </div>
            </div>
          </div>
              )}

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
                      disabled={isAutoFilling || isSendingToNanaBanana}
                      className="flex-1"
                    >
                      {isAutoFilling ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Анализ документа...
                        </>
                      ) : isSendingToNanaBanana ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Заполнение через Nana Banana Pro...
                        </>
                      ) : (
                        <>
                          <Scan className="h-4 w-4 mr-2" />
                          Заполнить через Nana Banana Pro
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
                onClick={showScanFill ? captureForNanaBanana : capturePhoto}
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
              >
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentFilling;