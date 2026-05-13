/**
 * PDF 生成器（占位 — 后续用 canvas 重采样后嵌入）
 * 当前方案：保存所有页到相册，避免内存溢出
 */

function saveAllToAlbum(imagePaths) {
  return new Promise((resolve, reject) => {
    let done = 0;
    const total = imagePaths.length;
    const failed = [];

    function next(index) {
      if (index >= total) {
        if (failed.length === 0) resolve();
        else reject(failed);
        return;
      }
      wx.saveImageToPhotosAlbum({
        filePath: imagePaths[index],
        success: () => { done++; next(index + 1); },
        fail: () => { failed.push(index); next(index + 1); }
      });
    }

    if (total === 0) { resolve(); return; }
    next(0);
  });
}

/**
 * 生成 PDF 并保存到文件（后续迭代实现真正的 PDF）
 * 当前：保存所有页到相册作为替代
 */
function generatePDFFile(imagePaths) {
  return new Promise((resolve, reject) => {
    wx.authorize({
      scope: 'scope.writePhotosAlbum',
      success: () => {
        saveAllToAlbum(imagePaths).then(() => {
          resolve(null); // null = 已保存到相册，无 PDF 文件
        }).catch(reject);
      },
      fail: () => reject(new Error('no_album_permission'))
    });
  });
}

module.exports = { generatePDFFile, saveAllToAlbum };
