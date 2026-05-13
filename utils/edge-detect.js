/**
 * 文档边缘检测
 * 流水线：灰度 → 高斯模糊 → Canny → 轮廓查找 → 四边形拟合
 */

function toGray(imageData) {
  const d = imageData.data;
  const gray = new Uint8Array(d.length / 4);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    gray[j] = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
  }
  return { gray, w: imageData.width, h: imageData.height };
}

function gaussianBlur(gray, w, h, kernelSize) {
  // 3x3 高斯核
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const kSum = 16;
  const output = new Uint8Array(gray.length);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * w + (x + kx);
          const kidx = (ky + 1) * 3 + (kx + 1);
          sum += gray[idx] * kernel[kidx];
        }
      }
      output[y * w + x] = Math.round(sum / kSum);
    }
  }
  return output;
}

function cannyEdge(gray, w, h) {
  // Sobel 算子计算梯度
  const grad = new Float32Array(gray.length);
  const dir = new Float32Array(gray.length);
  let maxGrad = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx = -gray[(y-1)*w+(x-1)] + gray[(y-1)*w+(x+1)]
               - 2*gray[y*w+(x-1)] + 2*gray[y*w+(x+1)]
               - gray[(y+1)*w+(x-1)] + gray[(y+1)*w+(x+1)];
      const gy = -gray[(y-1)*w+(x-1)] - 2*gray[(y-1)*w+x] - gray[(y-1)*w+(x+1)]
               + gray[(y+1)*w+(x-1)] + 2*gray[(y+1)*w+x] + gray[(y+1)*w+(x+1)];
      const mag = Math.sqrt(gx * gx + gy * gy);
      grad[y * w + x] = mag;
      dir[y * w + x] = Math.atan2(gy, gx);
      if (mag > maxGrad) maxGrad = mag;
    }
  }

  // 非极大值抑制 + 双阈值
  const highThresh = maxGrad * 0.2;
  const lowThresh = maxGrad * 0.1;
  const edge = new Uint8Array(gray.length);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (grad[y * w + x] < lowThresh) continue;

      // 梯度方向量化到 4 个方向
      let angle = dir[y * w + x] + Math.PI;
      let sector;
      if (angle < Math.PI / 8 || angle >= 15 * Math.PI / 8) sector = 0;      // E-W
      else if (angle < 3 * Math.PI / 8) sector = 1;                           // NE-SW
      else if (angle < 5 * Math.PI / 8) sector = 2;                          // N-S
      else if (angle < 7 * Math.PI / 8) sector = 3;                          // NW-SE
      else if (angle < 9 * Math.PI / 8) sector = 0;
      else if (angle < 11 * Math.PI / 8) sector = 1;
      else if (angle < 13 * Math.PI / 8) sector = 2;
      else sector = 3;

      // 非极大值抑制
      let n1, n2;
      if (sector === 0) { n1 = grad[y * w + (x - 1)]; n2 = grad[y * w + (x + 1)]; }
      else if (sector === 2) { n1 = grad[(y - 1) * w + x]; n2 = grad[(y + 1) * w + x]; }
      else if (sector === 1) { n1 = grad[(y - 1) * w + (x - 1)]; n2 = grad[(y + 1) * w + (x + 1)]; }
      else { n1 = grad[(y - 1) * w + (x + 1)]; n2 = grad[(y + 1) * w + (x - 1)]; }

      if (grad[y * w + x] >= n1 && grad[y * w + x] >= n2) {
        edge[y * w + x] = grad[y * w + x] >= highThresh ? 255 : 128;
      }
    }
  }

  // 滞后阈值：连接弱边缘
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (edge[y * w + x] === 128) {
        let strong = false;
        for (let dy = -1; dy <= 1 && !strong; dy++) {
          for (let dx = -1; dx <= 1 && !strong; dx++) {
            if (edge[(y + dy) * w + (x + dx)] === 255) strong = true;
          }
        }
        edge[y * w + x] = strong ? 255 : 0;
      }
    }
  }

  return edge;
}

function findContours(edge, w, h) {
  // 简化：从边缘图中采样，提取边界点
  const points = [];
  const step = 4; // 采样步长
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (edge[y * w + x] === 255) {
        points.push([x, y]);
      }
    }
  }
  return points;
}

function fitQuadrilateral(points, w, h) {
  if (points.length < 20) {
    // 没找到足够的边缘点，返回默认区域
    const margin = 0.1;
    return [
      [w * margin, h * margin],
      [w * (1 - margin), h * margin],
      [w * (1 - margin), h * (1 - margin)],
      [w * margin, h * (1 - margin)]
    ];
  }

  // 找四个极值点作为角点近似
  let topMost = points[0], bottomMost = points[0];
  let leftMost = points[0], rightMost = points[0];

  for (const p of points) {
    if (p[1] < topMost[1]) topMost = p;
    if (p[1] > bottomMost[1]) bottomMost = p;
    if (p[0] < leftMost[0]) leftMost = p;
    if (p[0] > rightMost[0]) rightMost = p;
  }

  // 用极值点拟合四边形：左上/右上/右下/左下
  const corners = [
    [(leftMost[0] + topMost[0]) / 2, (leftMost[1] + topMost[1]) / 2],
    [(rightMost[0] + topMost[0]) / 2, (rightMost[1] + topMost[1]) / 2],
    [(rightMost[0] + bottomMost[0]) / 2, (rightMost[1] + bottomMost[1]) / 2],
    [(leftMost[0] + bottomMost[0]) / 2, (leftMost[1] + bottomMost[1]) / 2]
  ];

  // 约束在图像范围内
  return corners.map(([x, y]) => [
    Math.max(0, Math.min(w - 1, Math.round(x))),
    Math.max(0, Math.min(h - 1, Math.round(y)))
  ]);
}

/**
 * 检测文档边缘
 * @param {ImageData} imageData
 * @returns {{ corners: number[][], confidence: number }}
 */
function detectEdges(imageData) {
  const { gray, w, h } = toGray(imageData);
  const blurred = gaussianBlur(gray, w, h);
  const edge = cannyEdge(blurred, w, h);
  const contours = findContours(edge, w, h);
  const corners = fitQuadrilateral(contours, w, h);

  return {
    corners,
    confidence: contours.length > 100 ? 0.8 : contours.length > 20 ? 0.5 : 0.3
  };
}

module.exports = { detectEdges, toGray, gaussianBlur, cannyEdge };
