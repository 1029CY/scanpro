/**
 * 图像滤镜处理
 * 在微信小程序 OffscreenCanvas 上操作像素数据
 */

// 灰度：加权平均
function grayscale(imageData) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    d[i] = d[i + 1] = d[i + 2] = gray;
  }
  return imageData;
}

// 黑白：自适应阈值（大津法 + 局部均值回退）
function blackAndWhite(imageData) {
  const d = imageData.data;
  const len = d.length / 4;

  // 计算直方图
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) {
    hist[Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114)]++;
  }

  // 大津法求阈值
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let wB = 0, wF = 0, sumB = 0;
  let maxVariance = 0, threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = len - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  // 应用二值化
  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const v = gray > threshold ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  return imageData;
}

// 增强锐化：USM (Unsharp Masking)
function enhance(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const d = imageData.data;
  const src = new Uint8ClampedArray(d);

  const amount = 1.2;
  const radius = 1;
  const threshold = 0;

  // 简单 3x3 模糊
  function getBlur(x, y, c) {
    let sum = 0, count = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          sum += src[(ny * w + nx) * 4 + c];
          count++;
        }
      }
    }
    return sum / count;
  }

  // 对比度拉伸
  let minVal = 255, maxVal = 0;
  for (let i = 0; i < d.length; i += 4) {
    const gray = src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114;
    if (gray < minVal) minVal = gray;
    if (gray > maxVal) maxVal = gray;
  }
  const range = maxVal - minVal || 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const blur = getBlur(x, y, c);
        let diff = src[i + c] - blur;
        if (Math.abs(diff) < threshold) diff = 0;
        let val = src[i + c] + amount * diff;
        // 对比度拉伸
        val = ((val - minVal) / range) * 255;
        d[i + c] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
  }
  return imageData;
}

// 原色：不做修改
function original(imageData) {
  return imageData;
}

const filters = {
  original,
  enhanced: enhance,
  bw: blackAndWhite,
  grayscale: grayscale
};

function applyFilter(imageData, filterType) {
  const fn = filters[filterType] || enhance;
  return fn(imageData);
}

module.exports = { applyFilter, grayscale, blackAndWhite, enhance, original };
