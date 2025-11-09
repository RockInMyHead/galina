import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileEdit, FileText, CheckCircle2, ArrowRight, Scan, Camera, X, RotateCw, ZoomIn, Upload } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useRef, useCallback, useEffect } from "react";
import { DOCUMENT_TEMPLATES } from "@/config/constants";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Проверяем размер файла (максимум 15MB для совместимости с Vision API)
    if (file.size > 15 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер: 15MB для изображений');
      return;
    }

    // Проверяем тип файла
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Неподдерживаемый тип файла. Разрешены: JPEG, PNG, PDF');
      return;
    }

    setIsUploadingFile(true);

    try {
      // Конвертируем файл в base64
      const reader = new FileReader();
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

  // Функция анализа документа
  const handleAnalyzeDocument = async () => {
    if (!uploadedFile) return;

    setIsAnalyzingDocument(true);
    setAnalysisResult('');

    try {
      // Создаем сообщение для анализа документа
      const analysisPrompt = `Ты - Галина, опытный AI-юрист. Пользователь загрузил документ для анализа.

ТВОЯ ЗАДАЧА:
1. Проанализируй изображение документа и извлеки всю видимую информацию
2. Определи тип документа (паспорт, договор, свидетельство, справка и т.д.)
3. Найди все персональные данные, которые можно извлечь:
   - ФИО (полностью)
   - Дата рождения
   - Паспортные данные (серия, номер, когда и кем выдан)
   - Адреса регистрации/проживания
   - Контактные данные (телефон, email)
   - Другие идентифицирующие данные

4. После анализа сообщи пользователю:
   - Какой тип документа ты распознала
   - Какие данные удалось извлечь
   - Какие данные пользователь может использовать для заполнения документов
   - Предложи варианты использования этих данных

ВАЖНО:
- Будь максимально точным в извлечении данных
- Если данные трудно прочитать, укажи это
- Не придумывай данные, которых нет на изображении
- Будь полезным и предложи конкретные действия

Ответь на русском языке в дружелюбной форме.`;

      // Преобразуем сообщения в формат, понятный OpenAI API
      const openaiMessages = [
        {
          role: 'system',
          content: 'Ты - Галина, опытный AI-юрист, специализирующийся на анализе документов.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: analysisPrompt
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
      ];

      // Fallback: если Vision API не работает, используем текстовый анализ
      const fallbackMessages = [
        {
          role: 'system',
          content: `Ты - Галина, опытный AI-юрист с 25-летним стажем. Ты специализируешься на анализе юридических документов и извлечении персональных данных.

ОСОБЕННОСТИ ТВОЕЙ РАБОТЫ:
- Ты всегда даешь конкретные, практические рекомендации
- Ты знаешь все типы российских документов
- Ты предлагаешь реальные действия для извлечения данных
- Ты структурируешь информацию четко и понятно
- Ты никогда не говоришь "я не могу анализировать", а даешь полезные советы

КОГДА VISION API НЕДОСТУПЕН:
- Определи наиболее вероятный тип документа по названию файла
- Дай подробные инструкции по извлечению данных
- Предложи конкретные поля для заполнения
- Дай советы по дальнейшим действиям`
        },
        {
          role: 'user',
          content: `Пользователь загрузил документ с названием "${uploadedFile.name}". Проанализируй название файла и дай профессиональные рекомендации по извлечению данных из этого типа документа.

${analysisPrompt}

ВАЖНО: Не говори что не можешь анализировать изображение. Дай конкретные практические рекомендации по извлечению данных из документа этого типа.`
        }
      ];

      // Сначала пытаемся отправить запрос с изображением
      let response;
      let data;
      let analysisText;

      try {
        // Проверяем размер файла перед отправкой (OpenAI ограничивает ~20MB для изображений)
        const fileSizeMB = uploadedFile.data.length / (1024 * 1024);

        if (fileSizeMB > 15) { // Если файл больше 15MB, сразу переходим к fallback
          console.log(`Файл слишком большой (${fileSizeMB.toFixed(1)}MB), используем текстовый анализ`);
          throw new Error('FILE_TOO_LARGE');
        }

        console.log('Отправка запроса анализа документа с изображением:', {
          messages: openaiMessages,
          model: 'gpt-4o',
          max_tokens: 1500,
          temperature: 0.3,
          stream: false,
          fileSize: `${fileSizeMB.toFixed(1)}MB`
        });

        response = await fetch('http://localhost:3001/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: openaiMessages,
            model: 'gpt-4o',
            max_tokens: 1500,
            temperature: 0.3, // Более точный анализ
            stream: false // Для анализа используем не streaming
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        data = await response.json();
        analysisText = data.choices[0]?.message?.content || 'Не удалось проанализировать документ';

      } catch (visionError) {
        if (visionError.message === 'FILE_TOO_LARGE') {
          console.log('Файл слишком большой для Vision API, переключаемся на текстовый анализ');
        } else {
          console.log('Vision API недоступен, переключаемся на интеллектуальный анализ по типу документа');
        }

        // Fallback к текстовому анализу
        console.log('Отправка fallback запроса анализа документа:', {
          messages: fallbackMessages,
          model: 'gpt-4o',
          max_tokens: 1500,
          temperature: 0.3,
          stream: false
        });

        response = await fetch('http://localhost:3001/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: fallbackMessages,
            model: 'gpt-4o',
            max_tokens: 1500,
            temperature: 0.3, // Более точный анализ
            stream: false // Для анализа используем не streaming
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        data = await response.json();
        analysisText = data.choices[0]?.message?.content || 'Не удалось проанализировать документ';
      }

      setAnalysisResult(analysisText);

    } catch (error) {
      console.error('Ошибка анализа документа:', error);
      setAnalysisResult('Произошла ошибка при анализе документа. Попробуйте еще раз.');
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
                    uploadedFile ? 'border-green-200 bg-green-50/50' : ''
                  }`} onClick={handleUploadDocument}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                          uploadedFile ? 'bg-green-500/20 text-green-700' : 'bg-green-500/10 text-green-600'
                        }`}>
                          <Upload className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-smooth">
                            {uploadedFile ? 'Заменить документ' : 'Загрузить документ'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {isUploadingFile ? "Загрузка..." :
                             uploadedFile ?
                             `Загружен: ${uploadedFile.name}` :
                             "Выберите файл с компьютера (JPEG, PNG, PDF до 10MB)"}
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
                            {uploadedFile.type.startsWith('image/') ? (
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
                                  <p className="text-sm text-muted-foreground">Изображение</p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-16 bg-white rounded border flex items-center justify-center">
                                  <FileText className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium">{uploadedFile.name}</p>
                                  <p className="text-sm text-muted-foreground">PDF документ</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Кнопка анализа */}
                          {!analysisResult && (
                            <Button
                              onClick={handleAnalyzeDocument}
                              disabled={isAnalyzingDocument}
                              className="w-full"
                            >
                              {isAnalyzingDocument ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Анализ документа...
                                </>
                              ) : (
                                'Анализировать документ'
                              )}
                            </Button>
                          )}

                          {/* Результаты анализа */}
                          {analysisResult && (
                            <div className="space-y-4">
                              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <h4 className="font-semibold text-blue-900 mb-2">Результаты анализа:</h4>
                                <div className="text-sm text-blue-800 whitespace-pre-wrap">
                                  {analysisResult}
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    // Сохраняем анализ в localStorage для использования в чате
                                    localStorage.setItem('documentAnalysis', analysisResult);
                                    localStorage.setItem('analyzedFile', JSON.stringify(uploadedFile));
                                    navigate('/chat');
                                  }}
                                  className="flex-1"
                                >
                                  Использовать данные в чате
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => setAnalysisResult('')}
                                >
                                  Новый анализ
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>

              <Card className="border-border/50 bg-primary/5">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    Как это работает?
                  </h3>
                  <ol className="space-y-3">
                    {[
                      "Выберите нужный шаблон документа",
                      "Ответьте на вопросы Галины о деталях",
                      "AI автоматически заполнит документ",
                      "Проверьте и скачайте готовый файл",
                    ].map((step, index) => (
                      <li key={index} className="flex items-start gap-3 text-sm">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground flex-shrink-0 text-xs font-semibold">
                          {index + 1}
                        </div>
                        <span className="text-muted-foreground mt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
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
    </div>
  );
};

export default DocumentFilling;
