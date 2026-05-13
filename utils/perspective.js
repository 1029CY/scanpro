/**
 * 透视变换：四点法求解单应性矩阵 + 反向映射 + 双线性插值
 */

// 解 8x8 线性方程组求单应性矩阵
function solveHomography(srcPoints, dstPoints) {
  const A = [];
  const b = [];

  for (let i = 0; i < 4; i++) {
    const [sx, sy] = srcPoints[i];
    const [dx, dy] = dstPoints[i];
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dx, dy);
  }

  // 高斯消元
  const n = 8;
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    [b[col], b[maxRow]] = [b[maxRow], b[col]];

    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col];
      for (let j = col; j < n; j++) {
        A[row][j] -= factor * A[col][j];
      }
      b[row] -= factor * b[col];
    }
  }

  // 回代
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) sum -= A[i][j] * x[j];
    x[i] = sum / A[i][i];
  }

  return [
    [x[0], x[1], x[2]],
    [x[3], x[4], x[5]],
    [x[6], x[7], 1]
  ];
}

// 双线性插值
function bilinearInterpolate(imageData, x, y) {
  const w = imageData.width;
  const h = imageData.height;
  const d = imageData.data;

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = x - x0;
  const fy = y - y0;

  const result = [0, 0, 0, 255];

  if (x0 < 0 || x0 >= w || y0 < 0 || y0 >= h) return result;

  for (let c = 0; c < 3; c++) {
    const i00 = (y0 * w + x0) * 4 + c;
    const i10 = (y0 * w + x1) * 4 + c;
    const i01 = (y1 * w + x0) * 4 + c;
    const i11 = (y1 * w + x1) * 4 + c;

    result[c] = d[i00] * (1 - fx) * (1 - fy) +
                d[i10] * fx * (1 - fy) +
                d[i01] * (1 - fx) * fy +
                d[i11] * fx * fy;
  }

  return result;
}

// 应用单应性矩阵映射
function applyHomography(H, px, py) {
  const denom = H[2][0] * px + H[2][1] * py + H[2][2];
  const x = (H[0][0] * px + H[0][1] * py + H[0][2]) / denom;
  const y = (H[1][0] * px + H[1][1] * py + H[1][2]) / denom;
  return [x, y];
}

/**
 * 执行透视变换
 * @param {ImageData} srcImageData - 源图像像素数据
 * @param {number[][]} srcCorners - 源四边形四个角点 [[x,y],[x,y],[x,y],[x,y]] (左上/右上/右下/左下)
 * @param {number} dstWidth - 输出宽度
 * @param {number} dstHeight - 输出高度
 * @returns {ImageData}
 */
function perspectiveTransform(srcImageData, srcCorners, dstWidth, dstHeight) {
  const dstPoints = [
    [0, 0],
    [dstWidth - 1, 0],
    [dstWidth - 1, dstHeight - 1],
    [0, dstHeight - 1]
  ];

  // 从目标到源的反向映射（避免空洞）
  const H = solveHomography(dstPoints, srcCorners);
  const output = new ImageData(dstWidth, dstHeight);

  for (let dy = 0; dy < dstHeight; dy++) {
    for (let dx = 0; dx < dstWidth; dx++) {
      const [sx, sy] = applyHomography(H, dx, dy);
      const pixel = bilinearInterpolate(srcImageData, sx, sy);
      const idx = (dy * dstWidth + dx) * 4;
      output.data[idx] = pixel[0];
      output.data[idx + 1] = pixel[1];
      output.data[idx + 2] = pixel[2];
      output.data[idx + 3] = 255;
    }
  }

  return output;
}

module.exports = { solveHomography, perspectiveTransform };
