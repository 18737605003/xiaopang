import { Router } from 'express';
import { authenticate, authorizeReadOnly } from '../middleware/auth.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../../data/system-config.json');

// 所有设置路由都需要认证，GET允许所有用户，其他操作只允许管理员
router.use(authenticate);
router.use(authorizeReadOnly('ADMIN'));

// 获取系统配置
router.get('/', async (req, res) => {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data);
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: '读取配置失败' });
  }
});

// 更新系统配置（仅管理员）
router.post('/', async (req, res) => {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data);
    
    const updatedConfig = {
      ...config,
      ...req.body,
    };
    
    await fs.writeFile(CONFIG_PATH, JSON.stringify(updatedConfig, null, 2));
    res.json({ message: '配置保存成功' });
  } catch (error) {
    res.status(500).json({ message: '保存配置失败' });
  }
});

// 添加 API Key（仅管理员）
router.post('/api-keys', async (req, res) => {
  try {
    const { provider, name, key } = req.body;
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data);
    
    if (!config.providers[provider]) {
      return res.status(400).json({ message: '无效的提供商' });
    }
    
    const newKey = {
      id: Date.now().toString(),
      name,
      key,
    };
    
    config.providers[provider].apiKeys.push(newKey);
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    
    res.json({ message: 'API Key 添加成功', data: newKey });
  } catch (error) {
    res.status(500).json({ message: '添加失败' });
  }
});

// 删除 API Key（仅管理员）
router.delete('/api-keys/:provider/:id', async (req, res) => {
  try {
    const { provider, id } = req.params;
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data);
    
    if (!config.providers[provider]) {
      return res.status(400).json({ message: '无效的提供商' });
    }
    
    config.providers[provider].apiKeys = config.providers[provider].apiKeys.filter(
      (k: any) => k.id !== id
    );
    
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    res.json({ message: 'API Key 删除成功' });
  } catch (error) {
    res.status(500).json({ message: '删除失败' });
  }
});

// 添加模型（仅管理员）
router.post('/models', async (req, res) => {
  try {
    const { provider, name, value } = req.body;
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data);
    
    if (!config.providers[provider]) {
      return res.status(400).json({ message: '无效的提供商' });
    }
    
    const newModel = {
      id: Date.now().toString(),
      name,
      value,
    };
    
    config.providers[provider].models.push(newModel);
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    
    res.json({ message: '模型添加成功', data: newModel });
  } catch (error) {
    res.status(500).json({ message: '添加失败' });
  }
});

// 删除模型（仅管理员）
router.delete('/models/:provider/:id', async (req, res) => {
  try {
    const { provider, id } = req.params;
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data);
    
    if (!config.providers[provider]) {
      return res.status(400).json({ message: '无效的提供商' });
    }
    
    config.providers[provider].models = config.providers[provider].models.filter(
      (m: any) => m.id !== id
    );
    
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    res.json({ message: '模型删除成功' });
  } catch (error) {
    res.status(500).json({ message: '删除失败' });
  }
});

// 更新提供商 URL（仅管理员）
router.patch('/providers/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { apiUrl } = req.body;
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data);
    
    if (!config.providers[provider]) {
      return res.status(400).json({ message: '无效的提供商' });
    }
    
    config.providers[provider].apiUrl = apiUrl;
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    
    res.json({ message: 'API URL 更新成功' });
  } catch (error) {
    res.status(500).json({ message: '更新失败' });
  }
});

// 添加文档模板（仅管理员）
router.post('/doc-templates', async (req, res) => {
  try {
    const { name, content } = req.body;
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data);
    
    const newTemplate = {
      id: Date.now().toString(),
      name,
      content,
    };
    
    if (!config.docTemplates) {
      config.docTemplates = [];
    }
    
    config.docTemplates.push(newTemplate);
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    
    res.json({ message: '模板添加成功', data: newTemplate });
  } catch (error) {
    res.status(500).json({ message: '添加失败' });
  }
});

// 更新文档模板（仅管理员）
router.put('/doc-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, content } = req.body;
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data);
    
    const templateIndex = config.docTemplates?.findIndex((t: any) => t.id === id);
    if (templateIndex === -1 || templateIndex === undefined) {
      return res.status(404).json({ message: '模板不存在' });
    }
    
    config.docTemplates[templateIndex] = {
      ...config.docTemplates[templateIndex],
      name,
      content,
    };
    
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    res.json({ message: '模板更新成功' });
  } catch (error) {
    res.status(500).json({ message: '更新失败' });
  }
});

// 删除文档模板（仅管理员）
router.delete('/doc-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data);
    
    if (!config.docTemplates) {
      return res.status(404).json({ message: '模板不存在' });
    }
    
    config.docTemplates = config.docTemplates.filter((t: any) => t.id !== id);
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    
    res.json({ message: '模板删除成功' });
  } catch (error) {
    res.status(500).json({ message: '删除失败' });
  }
});

export default router;
