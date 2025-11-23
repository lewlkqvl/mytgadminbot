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
  const width = 240;
  const height = 100;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 创建渐变背景
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#f0f0f0');
  gradient.addColorStop(0.5, '#e8e8e8');
  gradient.addColorStop(1, '#f5f5f5');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 添加更多背景噪点
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = randomColor(180, 230);
    ctx.fillRect(
      Math.random() * width,
      Math.random() * height,
      Math.random() * 2,
      Math.random() * 2
    );
  }

  // 添加波浪形干扰线
  for (let i = 0; i < 15; i++) {
    ctx.strokeStyle = randomColor(100, 180);
    ctx.lineWidth = Math.random() * 2 + 0.5;
    ctx.beginPath();
    const startX = Math.random() * width;
    const startY = Math.random() * height;
    ctx.moveTo(startX, startY);

    // 创建贝塞尔曲线
    const cp1x = Math.random() * width;
    const cp1y = Math.random() * height;
    const cp2x = Math.random() * width;
    const cp2y = Math.random() * height;
    const endX = Math.random() * width;
    const endY = Math.random() * height;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
    ctx.stroke();
  }

  // 添加更多干扰圆圈
  for (let i = 0; i < 30; i++) {
    ctx.strokeStyle = randomColor(120, 200);
    ctx.lineWidth = Math.random() * 1.5;
    ctx.beginPath();
    ctx.arc(
      Math.random() * width,
      Math.random() * height,
      Math.random() * 15 + 5,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }

  // 添加密集的干扰点
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = randomColor(100, 220);
    ctx.beginPath();
    ctx.arc(
      Math.random() * width,
      Math.random() * height,
      Math.random() * 1.5 + 0.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // 添加网格状干扰
  ctx.strokeStyle = 'rgba(150, 150, 150, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < width; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }
  for (let i = 0; i < height; i += 10) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(width, i);
    ctx.stroke();
  }

  // 绘制验证码文本
  const fontSize = 45;
  const charSpacing = width / (text.length + 1);
  const colors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
    '#9b59b6', '#1abc9c', '#e67e22', '#16a085',
    '#c0392b', '#2980b9'
  ];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // 设置字体，使用多种字体增加复杂度
    const fonts = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana'];
    const randomFont = fonts[Math.floor(Math.random() * fonts.length)];
    const randomFontSize = fontSize + Math.random() * 12 - 6;
    const fontWeight = Math.random() > 0.5 ? 'bold' : '900';
    ctx.font = `${fontWeight} ${randomFontSize}px ${randomFont}`;

    // 使用更鲜艳的颜色
    ctx.fillStyle = colors[i % colors.length];

    // 增加旋转角度
    const angle = (Math.random() * 40 - 20) * (Math.PI / 180);

    // 计算位置，增加垂直偏移
    const x = charSpacing * (i + 1);
    const y = height / 2 + (Math.random() * 20 - 10);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // 添加字符缩放变形
    const scaleX = 0.9 + Math.random() * 0.3;
    const scaleY = 0.9 + Math.random() * 0.3;
    ctx.scale(scaleX, scaleY);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 添加多层阴影效果
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillText(char, 0, 0);

    // 添加描边效果
    ctx.strokeStyle = colors[(i + 3) % colors.length];
    ctx.lineWidth = 0.5;
    ctx.strokeText(char, 0, 0);

    ctx.restore();
  }

  // 添加前景干扰线（覆盖在文字上）
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = randomColor(80, 160);
    ctx.lineWidth = Math.random() * 2 + 1;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.lineTo(Math.random() * width, Math.random() * height);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  // 添加更明显的边框
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, width - 3, height - 3);

  // 添加内边框
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 1;
  ctx.strokeRect(5, 5, width - 10, height - 10);

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
