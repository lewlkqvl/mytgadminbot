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
 * 生成验证码图片
 * @param {string} text 验证码文本
 * @returns {Buffer} 图片 Buffer
 */
function generateCaptchaImage(text) {
  const width = 200;
  const height = 80;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 随机背景颜色（浅色）
  const bgColor = `rgb(${200 + Math.random() * 55}, ${200 + Math.random() * 55}, ${200 + Math.random() * 55})`;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // 添加干扰线
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = `rgb(${Math.random() * 100}, ${Math.random() * 100}, ${Math.random() * 100})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.lineTo(Math.random() * width, Math.random() * height);
    ctx.stroke();
  }

  // 添加干扰点
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
    ctx.beginPath();
    ctx.arc(
      Math.random() * width,
      Math.random() * height,
      Math.random() * 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // 绘制验证码文本
  const fontSize = 32;
  const charSpacing = width / (text.length + 1);

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // 随机字体大小
    const randomFontSize = fontSize + Math.random() * 10 - 5;
    ctx.font = `bold ${randomFontSize}px Arial, sans-serif`;

    // 随机颜色（深色）
    ctx.fillStyle = `rgb(${Math.random() * 100}, ${Math.random() * 100}, ${Math.random() * 100})`;

    // 随机旋转角度
    const angle = (Math.random() * 30 - 15) * (Math.PI / 180);

    // 计算位置
    const x = charSpacing * (i + 1);
    const y = height / 2 + Math.random() * 10 - 5;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }

  // 添加边框
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);

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
