/**
 * 文件服务
 * 处理文件上传、下载、管理相关业务逻辑
 */

const BaseService = require('../base/BaseService');
const path = require('path');
const fs = require('fs').promises;

class FileService extends BaseService {
  constructor() {
    super();
    this.uploadDir = process.env.UPLOAD_DIR || 'uploads';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
    this.allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,gif,pdf,doc,docx').split(',');
  }

  /**
   * 上传文件
   * @param {Object} fileData - 文件数据
   * @param {Object} options - 上传选项
   * @returns {Promise<Object>} 上传结果
   */
  async uploadFile(fileData, options = {}) {
    try {
      this.logAction('上传文件', { 
        filename: fileData.originalname, 
        size: fileData.size,
        mimetype: fileData.mimetype 
      });

      // 验证文件
      const validation = this.validateFile(fileData);
      if (!validation.isValid) {
        throw new Error('文件验证失败: ' + validation.errors.join(', '));
      }

      // 生成文件名
      const filename = this.generateFilename(fileData.originalname);
      const filepath = path.join(this.uploadDir, filename);

      // 确保上传目录存在
      await this.ensureDirectoryExists(path.dirname(filepath));

      // 保存文件
      await fs.writeFile(filepath, fileData.buffer);

      const result = {
        filename,
        originalname: fileData.originalname,
        size: fileData.size,
        mimetype: fileData.mimetype,
        path: filepath,
        url: `/uploads/${filename}`,
        uploadedAt: new Date()
      };

      this.logAction('文件上传成功', { filename, size: fileData.size });
      return result;

    } catch (error) {
      this.logError('文件上传失败', error, fileData);
      throw error;
    }
  }

  /**
   * 删除文件
   * @param {string} filename - 文件名
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteFile(filename) {
    try {
      this.logAction('删除文件', { filename });

      const filepath = path.join(this.uploadDir, filename);
      
      // 检查文件是否存在
      try {
        await fs.access(filepath);
      } catch (error) {
        throw new Error('文件不存在');
      }

      // 删除文件
      await fs.unlink(filepath);

      this.logAction('文件删除成功', { filename });
      return true;

    } catch (error) {
      this.logError('文件删除失败', error, { filename });
      throw error;
    }
  }

  /**
   * 获取文件信息
   * @param {string} filename - 文件名
   * @returns {Promise<Object>} 文件信息
   */
  async getFileInfo(filename) {
    try {
      this.logAction('获取文件信息', { filename });

      const filepath = path.join(this.uploadDir, filename);
      
      // 检查文件是否存在
      try {
        const stats = await fs.stat(filepath);
        
        const fileInfo = {
          filename,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          path: filepath,
          url: `/uploads/${filename}`
        };

        this.logAction('获取文件信息成功', { filename });
        return fileInfo;

      } catch (error) {
        throw new Error('文件不存在');
      }

    } catch (error) {
      this.logError('获取文件信息失败', error, { filename });
      throw error;
    }
  }

  /**
   * 获取文件列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 文件列表
   */
  async getFileList(options = {}) {
    try {
      this.logAction('获取文件列表', options);

      const { limit = 50, offset = 0, type } = options;

      // 读取上传目录
      const files = await fs.readdir(this.uploadDir);
      
      // 获取文件详细信息
      const fileInfos = await Promise.all(
        files.map(async (filename) => {
          try {
            const filepath = path.join(this.uploadDir, filename);
            const stats = await fs.stat(filepath);
            
            return {
              filename,
              size: stats.size,
              createdAt: stats.birthtime,
              modifiedAt: stats.mtime,
              extension: path.extname(filename).toLowerCase(),
              url: `/uploads/${filename}`
            };
          } catch (error) {
            return null;
          }
        })
      );

      // 过滤掉无效文件
      let validFiles = fileInfos.filter(file => file !== null);

      // 按类型过滤
      if (type) {
        validFiles = validFiles.filter(file => {
          const imageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
          const documentTypes = ['.pdf', '.doc', '.docx', '.txt'];
          
          switch (type) {
            case 'image':
              return imageTypes.includes(file.extension);
            case 'document':
              return documentTypes.includes(file.extension);
            default:
              return true;
          }
        });
      }

      // 排序（按修改时间倒序）
      validFiles.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

      // 分页
      const paginatedFiles = validFiles.slice(offset, offset + limit);

      this.logAction('获取文件列表成功', { total: validFiles.length, returned: paginatedFiles.length });

      return {
        files: paginatedFiles,
        pagination: {
          total: validFiles.length,
          limit,
          offset,
          hasMore: offset + limit < validFiles.length
        }
      };

    } catch (error) {
      this.logError('获取文件列表失败', error);
      throw error;
    }
  }

  /**
   * 验证文件
   * @param {Object} fileData - 文件数据
   * @returns {Object} 验证结果
   */
  validateFile(fileData) {
    const errors = [];

    // 检查文件大小
    if (fileData.size > this.maxFileSize) {
      errors.push(`文件大小不能超过 ${this.maxFileSize / 1024 / 1024}MB`);
    }

    // 检查文件类型
    const extension = path.extname(fileData.originalname).toLowerCase().substring(1);
    if (!this.allowedTypes.includes(extension)) {
      errors.push(`不支持的文件类型，允许的类型：${this.allowedTypes.join(', ')}`);
    }

    // 检查文件名
    if (!fileData.originalname || fileData.originalname.length > 255) {
      errors.push('文件名无效或过长');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 生成文件名
   * @param {string} originalname - 原始文件名
   * @returns {string} 新文件名
   */
  generateFilename(originalname) {
    const extension = path.extname(originalname);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    
    return `${timestamp}_${random}${extension}`;
  }

  /**
   * 确保目录存在
   * @param {string} dirPath - 目录路径
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * 清理过期文件
   * @param {number} days - 保留天数
   * @returns {Promise<Object>} 清理结果
   */
  async cleanupExpiredFiles(days = 30) {
    try {
      this.logAction('清理过期文件', { days });

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const files = await fs.readdir(this.uploadDir);
      let deletedCount = 0;
      const errors = [];

      for (const filename of files) {
        try {
          const filepath = path.join(this.uploadDir, filename);
          const stats = await fs.stat(filepath);

          if (stats.mtime < cutoffDate) {
            await fs.unlink(filepath);
            deletedCount++;
          }
        } catch (error) {
          errors.push({ filename, error: error.message });
        }
      }

      const result = {
        deletedCount,
        errors,
        cutoffDate
      };

      this.logAction('清理过期文件完成', result);
      return result;

    } catch (error) {
      this.logError('清理过期文件失败', error);
      throw error;
    }
  }
}

module.exports = FileService;
