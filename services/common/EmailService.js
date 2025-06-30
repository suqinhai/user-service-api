/**
 * 邮件服务
 * 处理邮件发送相关业务逻辑
 */

const BaseService = require('../base/BaseService');

class EmailService extends BaseService {
  constructor() {
    super();
    this.emailConfig = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    };
  }

  /**
   * 发送邮件
   * @param {Object} emailData - 邮件数据
   * @returns {Promise<Object>} 发送结果
   */
  async sendEmail(emailData) {
    try {
      this.logAction('发送邮件', { to: emailData.to, subject: emailData.subject });

      // 验证邮件数据
      const validation = this.validateEmailData(emailData);
      if (!validation.isValid) {
        throw new Error('邮件数据验证失败: ' + validation.errors.map(e => e.message).join(', '));
      }

      // 这里应该集成实际的邮件发送服务
      // 例如：nodemailer, sendgrid, aws-ses 等
      
      // 模拟邮件发送
      const result = {
        messageId: this.generateId(),
        to: emailData.to,
        subject: emailData.subject,
        sentAt: new Date(),
        status: 'sent'
      };

      this.logAction('邮件发送成功', { messageId: result.messageId, to: emailData.to });
      return result;

    } catch (error) {
      this.logError('邮件发送失败', error, emailData);
      throw error;
    }
  }

  /**
   * 发送验证邮件
   * @param {string} email - 邮箱地址
   * @param {string} verificationCode - 验证码
   * @returns {Promise<Object>} 发送结果
   */
  async sendVerificationEmail(email, verificationCode) {
    const emailData = {
      to: email,
      subject: '邮箱验证',
      html: `
        <h2>邮箱验证</h2>
        <p>您的验证码是：<strong>${verificationCode}</strong></p>
        <p>验证码有效期为10分钟，请及时使用。</p>
      `
    };

    return await this.sendEmail(emailData);
  }

  /**
   * 发送密码重置邮件
   * @param {string} email - 邮箱地址
   * @param {string} resetToken - 重置令牌
   * @returns {Promise<Object>} 发送结果
   */
  async sendPasswordResetEmail(email, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const emailData = {
      to: email,
      subject: '密码重置',
      html: `
        <h2>密码重置</h2>
        <p>您请求重置密码，请点击下面的链接：</p>
        <a href="${resetUrl}">重置密码</a>
        <p>如果您没有请求重置密码，请忽略此邮件。</p>
        <p>此链接有效期为1小时。</p>
      `
    };

    return await this.sendEmail(emailData);
  }

  /**
   * 验证邮件数据
   * @param {Object} emailData - 邮件数据
   * @returns {Object} 验证结果
   */
  validateEmailData(emailData) {
    const rules = {
      to: {
        required: true,
        type: 'string',
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        patternMessage: '邮箱格式不正确'
      },
      subject: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 200
      }
    };

    return this.validateData(emailData, rules);
  }
}

module.exports = EmailService;
