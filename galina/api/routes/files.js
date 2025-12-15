// File management routes
const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');

// GET /files - Get list of user's files
router.get('/', async (req, res) => {
  try {
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    const files = await prisma.file.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ files });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// POST /files/upload - Upload a new file
router.post('/upload', async (req, res) => {
  try {
    const { name, type, size, content } = req.body;
    // Для демо получаем пользователя по email
    const user = await prisma.user.findFirst({
      where: { email: 'demo@galina.ai' }
    });
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    const userId = user.id;

    const file = await prisma.file.create({
      data: {
        name,
        type,
        size: parseInt(size),
        content,
        userId,
      },
    });

    res.json({ file });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// DELETE /files/:fileId - Delete a file
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    await prisma.file.delete({
      where: { id: fileId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;
