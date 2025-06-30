module.exports = {
  // 基础格式化选项
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  
  // 对象和数组格式化
  trailingComma: 'none',
  bracketSpacing: true,
  bracketSameLine: false,
  
  // 箭头函数参数
  arrowParens: 'avoid',
  
  // 换行符
  endOfLine: 'lf',
  
  // 嵌入式语言格式化
  embeddedLanguageFormatting: 'auto',
  
  // HTML 相关（如果有模板文件）
  htmlWhitespaceSensitivity: 'css',
  
  // 其他选项
  insertPragma: false,
  requirePragma: false,
  proseWrap: 'preserve',
  
  // 文件类型特定配置
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 80,
        tabWidth: 2
      }
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always'
      }
    },
    {
      files: '*.yml',
      options: {
        tabWidth: 2,
        singleQuote: false
      }
    }
  ]
};
