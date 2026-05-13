const STORAGE_KEY = 'scanRecords';
const USER_DATA_PATH = wx.env.USER_DATA_PATH;
const fs = wx.getFileSystemManager();

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getRecords() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY);
    return raw || [];
  } catch (e) {
    return [];
  }
}

function saveRecord(record) {
  const records = getRecords();
  const newRecord = Object.assign({
    id: uuid(),
    createTime: new Date().toISOString(),
    title: '',
    pageCount: 0,
    pages: []
  }, record);

  if (!newRecord.title) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    newRecord.title = 'Scan_' + d.getFullYear() + '-' +
      pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }

  newRecord.pageCount = newRecord.pages.length;
  records.unshift(newRecord);
  wx.setStorageSync(STORAGE_KEY, records);
  return newRecord;
}

function deleteRecord(id) {
  const records = getRecords();
  const record = records.find(r => r.id === id);
  if (record) {
    // 清理关联的图片文件
    record.pages.forEach(page => {
      if (page.localImagePath && page.localImagePath.startsWith(USER_DATA_PATH)) {
        try { fs.unlinkSync(page.localImagePath); } catch (e) { /* 忽略删除失败 */ }
      }
    });
  }
  const filtered = records.filter(r => r.id !== id);
  wx.setStorageSync(STORAGE_KEY, filtered);
  return filtered;
}

function saveImageFile(tempPath) {
  const fileName = 'scan_' + Date.now() + '_' + uuid() + '.jpg';
  const targetPath = USER_DATA_PATH + '/' + fileName;
  try {
    fs.copyFileSync(tempPath, targetPath);
    return targetPath;
  } catch (e) {
    // fallback: 如果复制失败，返回原临时路径
    return tempPath;
  }
}

function removeImageFile(filePath) {
  if (filePath && filePath.startsWith(USER_DATA_PATH)) {
    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
  }
}

module.exports = {
  getRecords,
  saveRecord,
  deleteRecord,
  saveImageFile,
  removeImageFile
};
