const { DataTypes } = require('sequelize');
const { REGISTER_CONFIG } = require('../../../common/constants/status');

module.exports = (sequelize) => {
  const RegisterConfig = sequelize.define('RegisterConfig', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    real_name_verification: {
      type: DataTypes.INTEGER,
      defaultValue: REGISTER_CONFIG.VERIFICATION_OFF,
      comment: '真实姓名验证开启状态(0:关闭,1:开启)'
    },
    real_name_required: {
      type: DataTypes.INTEGER,
      defaultValue: REGISTER_CONFIG.NOT_REQUIRED,
      comment: '真实姓名是否必填(0:否,1:是)'
    },
    phone_verification: {
      type: DataTypes.INTEGER,
      defaultValue: REGISTER_CONFIG.VERIFICATION_OFF,
      comment: '手机验证开启状态(0:关闭,1:开启)'
    },
    phone_required: {
      type: DataTypes.INTEGER,
      defaultValue: REGISTER_CONFIG.NOT_REQUIRED,
      comment: '手机是否必填(0:否,1:是)'
    },
    phone_verification_code: {
      type: DataTypes.INTEGER,
      defaultValue: REGISTER_CONFIG.VERIFICATION_OFF,
      comment: '是否开启手机验证码(0:否,1:是)'
    },
    captcha_type: {
      type: DataTypes.INTEGER,
      defaultValue: REGISTER_CONFIG.CAPTCHA_NONE,
      comment: '验证码类型(0:无,1:图形验证码,2:数字验证码,3:短信验证码)'
    },
    google_auth_enabled: {
      type: DataTypes.INTEGER,
      defaultValue: REGISTER_CONFIG.VERIFICATION_OFF,
      comment: '谷歌授权开启状态(0:关闭,1:开启)'
    },
    google_appId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '谷歌应用ID'
    },
    google_secret: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '谷歌应用密钥'
    },
    facebook_auth_enabled: {
      type: DataTypes.INTEGER,
      defaultValue: REGISTER_CONFIG.VERIFICATION_OFF,
      comment: 'Facebook授权开启状态(0:关闭,1:开启)'
    },
    facebook_appId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Facebook应用ID'
    },
    facebook_secret: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Facebook应用密钥'
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'register_configs',
    timestamps: false
  });

  return RegisterConfig;
}; 