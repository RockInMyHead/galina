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
                            {uploadedFile ? 'Заменить документ' : '📄 Создание документа на основе существующего'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {isUploadingFile ? "Загрузка..." :
                             uploadedFile ?
                             `Загружен: ${uploadedFile.name}` :
                             "Загрузите документ, и я открою чат для создания аналогичного документа"}
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
          {console.log('🎨 Rendering interactive chat modal')}
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
            {completedDocument && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-green-900 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Документ готов!
                  </h4>
                  <Button
                    onClick={downloadDocument}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Скачать
                  </Button>
                </div>
                <div className="bg-white p-3 rounded border max-h-40 overflow-y-auto">
                  <pre className="text-xs whitespace-pre-wrap font-mono">{completedDocument}</pre>
                </div>
              </div>
            )}

            {/* Поле ввода (показывается только если документ не готов) */}
            {!completedDocument && (
              <div className="flex gap-2">
                <textarea
                  value={currentUserInput}
                  onChange={(e) => setCurrentUserInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Введите ваш ответ..."
                  className="flex-1 min-h-[60px] max-h-[120px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isWaitingForAI}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!currentUserInput.trim() || isWaitingForAI}
                  className="self-end"
                >
                  Отправить
                </Button>
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
    </div>
  );
};

export default DocumentFilling;
