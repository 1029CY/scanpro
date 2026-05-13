/**
 * 图像处理管线编排
 * resize → edgeDetect → perspectiveTransform → applyFilter
 */

const { detectEdges } = require('./edge-detect');
const { perspectiveTransform } = require('./perspective');
const { applyFilter } = require('./filters');

/**
 * 在 OffscreenCanvas 上执行图像处理
 * @param {string} imagePath - 图片临时路径
 * @param {object} options - { filterType, cropPoints }
 * @returns {Promise<{processedPath: string, corners: number[][]}>}
 */
function processImage(imagePath, options = {}) {
  const { filterType = 'enhanced', cropPoints = null } = options;
  const maxDim = 1920;

  return new Promise((resolve, reject) => {
    // 使用 wx.createOffscreenCanvas（微信 2.16+）
    const canvas = wx.createOffscreenCanvas({ type: '2d', width: 1, height: 1 });
    const ctx = canvas.getContext('2d');

    // 先加载图片获取尺寸
    const img = canvas.createImage();
    img.onload = () => {
      const srcW = img.width;
      const srcH = img.height;

      // 计算 resize 比例
      let scale = 1;
      if (Math.max(srcW, srcH) > maxDim) {
        scale = maxDim / Math.max(srcW, srcH);
      }
      const w = Math.round(srcW * scale);
      const h = Math.round(srcH * scale);

      canvas.width = w;
      canvas.height = h;

      // 绘制缩放后的图片
      ctx.drawImage(img, 0, 0, w, h);
      let imageData = ctx.getImageData(0, 0, w, h);

      // Step 1: 边缘检测（如果没有手动设置的角点）
      let corners = cropPoints;
      if (!corners) {
        const result = detectEdges(imageData);
        corners = result.corners;
      }

      // Step 2: 透视变换
      // 输出尺寸：取四边形宽高中较大者，保持比例
      const quadW = Math.max(
        Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]),
        Math.hypot(corners[2][0] - corners[3][0], corners[2][1] - corners[3][1])
      );
      const quadH = Math.max(
        Math.hypot(corners[3][0] - corners[0][0], corners[3][1] - corners[0][1]),
        Math.hypot(corners[2][0] - corners[1][0], corners[2][1] - corners[1][1])
      );
      const aspectRatio = quadW / (quadH || 1);
      const dstW = Math.min(Math.max(Math.round(quadW), 400), maxDim);
      const dstH = Math.round(dstW / aspectRatio);

      const warped = perspectiveTransform(imageData, corners, dstW, dstH);

      // Step 3: 应用滤镜
      const filtered = applyFilter(warped, filterType);

      // Step 4: 输出到临时文件
      canvas.width = filtered.width;
      canvas.height = filtered.height;
      ctx.putImageData(filtered, 0, 0);

      const outPath = wx.env.USER_DATA_PATH + '/processed_' + Date.now() + '.jpg';
      // 通过 canvas.toTempFilePath 导出
      canvas.toTempFilePath({
        fileType: 'jpg',
        quality: 0.92,
        success: (res) => resolve({ processedPath: res.tempFilePath, corners }),
        fail: reject
      });
    };

    img.onerror = reject;
    img.src = imagePath;
  });
}

module.exports = { processImage };
