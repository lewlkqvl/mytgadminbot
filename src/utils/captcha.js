const { createCanvas } = require('canvas');

/**
 * 生成随机验证码文本（数字+字母组合，至少6位）
 * @param {number} length 验证码长度，默认6位
 * @returns {string} 验证码文本
 */
function generateCaptchaText(length = 6) {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  // 排除了容易混淆的字符：I, O, i, l, o
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成随机颜色
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @returns {string} RGB 颜色字符串
 */
function randomColor(min, max) {
  const r = Math.floor(Math.random() * (max - min) + min);
  const g = Math.floor(Math.random() * (max - min) + min);
  const b = Math.floor(Math.random() * (max - min) + min);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * 生成验证码图片
 * @param {string} text 验证码文本
 * @returns {Buffer} 图片 Buffer
 */
function generateCaptchaImage(text) {
  const width = 200;
  const height = 80;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 设置白色背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 添加彩色背景条纹
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = randomColor(220, 255);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.lineTo(Math.random() * width, Math.random() * height);
    ctx.stroke();
  }

  // 添加干扰线
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = randomColor(100, 200);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.lineTo(Math.random() * width, Math.random() * height);
    ctx.stroke();
  }

  // 添加干扰点
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = randomColor(150, 200);
    ctx.beginPath();
    ctx.arc(
      Math.random() * width,
      Math.random() * height,
      Math.random() * 2 + 1,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // 绘制验证码文本
  const fontSize = 40;
  const charSpacing = width / (text.length + 1);
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // 设置字体
    const randomFontSize = fontSize + Math.random() * 8 - 4;
    ctx.font = `bold ${randomFontSize}px Arial, Helvetica, sans-serif`;

    // 使用鲜艳的颜色
    ctx.fillStyle = colors[i % colors.length];

    // 随机旋转角度（减小角度，更容易识别）
    const angle = (Math.random() * 20 - 10) * (Math.PI / 180);

    // 计算位置
    const x = charSpacing * (i + 1);
    const y = height / 2 + (Math.random() * 10 - 5);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 添加文字阴影增强可读性
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillText(char, 0, 0);
    ctx.restore();
  }

  // 添加边框
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  return canvas.toBuffer('image/png');
}

/**
 * 生成完整的验证码（文本和图片）
 * @param {number} length 验证码长度，默认6位
 * @returns {Object} { text: string, image: Buffer }
 */
function generateCaptcha(length = 6) {
  const text = generateCaptchaText(length);
  const image = generateCaptchaImage(text);
  return { text, image };
}

module.exports = {
  generateCaptchaText,
  generateCaptchaImage,
  generateCaptcha
};
