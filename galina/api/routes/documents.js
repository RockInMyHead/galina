// Document analysis routes
const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');

// Сохранение анализа документа
router.post('/analyses', async (req, res) => {
  try {
    const { title, fileName, fileSize, analysis } = req.body;

    if (!title || !fileName || !fileSize || !analysis) {
      return res.status(400).json({ error: 'All fields are required: title, fileName, fileSize, analysis' });
    }

    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });

    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const documentAnalysis = await prisma.documentAnalysis.create({
      data: {
        title,
        fileName,
        fileSize: parseInt(fileSize),
        analysis,
        userId: user.id
      }
    });

    console.log('📄 Document analysis saved:', documentAnalysis.id);
    res.json({ documentAnalysis });
  } catch (error) {
    console.error('Error saving document analysis:', error);
    res.status(500).json({ error: 'Failed to save document analysis' });
  }
});

// Получение списка анализов пользователя
router.get('/analyses', async (req, res) => {
  try {
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });

    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const analyses = await prisma.documentAnalysis.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📄 Retrieved ${analyses.length} document analyses for user`);
    res.json({ analyses });
  } catch (error) {
    console.error('Error retrieving document analyses:', error);
    res.status(500).json({ error: 'Failed to retrieve document analyses' });
  }
});

// Получение конкретного анализа
router.get('/analyses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });

    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const analysis = await prisma.documentAnalysis.findFirst({
      where: {
        id,
        userId: user.id
      }
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Document analysis not found' });
    }

    console.log('📄 Retrieved document analysis:', analysis.id);
    res.json({ analysis });
  } catch (error) {
    console.error('Error retrieving document analysis:', error);
    res.status(500).json({ error: 'Failed to retrieve document analysis' });
  }
});

// Обновление анализа (изменение названия)
router.put('/analyses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });

    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const analysis = await prisma.documentAnalysis.updateMany({
      where: {
        id,
        userId: user.id
      },
      data: {
        title,
        updatedAt: new Date()
      }
    });

    if (analysis.count === 0) {
      return res.status(404).json({ error: 'Document analysis not found' });
    }

    console.log('📄 Document analysis updated:', id);
    res.json({ success: true, updated: analysis.count });
  } catch (error) {
    console.error('Error updating document analysis:', error);
    res.status(500).json({ error: 'Failed to update document analysis' });
  }
});

// Удаление анализа
router.delete('/analyses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });

    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const analysis = await prisma.documentAnalysis.deleteMany({
      where: {
        id,
        userId: user.id
      }
    });

    if (analysis.count === 0) {
      return res.status(404).json({ error: 'Document analysis not found' });
    }

    console.log('📄 Document analysis deleted:', id);
    res.json({ success: true, deleted: analysis.count });
  } catch (error) {
    console.error('Error deleting document analysis:', error);
    res.status(500).json({ error: 'Failed to delete document analysis' });
  }
});

module.exports = router;
