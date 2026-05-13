const { saveRecord, saveImageFile, getRecords } = require('../../utils/storage');
const { generatePDF } = require('../../utils/pdf-gen');

Page({
  data: {
    pages: [],
    currentIndex: 0,
    currentImage: '',
    filterType: 'enhanced',
    showCrop: false,
    isMultiPage: false,
    isHistory: false,
    recordId: null,
    canvasReady: false
  },

  onLoad(options) {
    this.initCanvas();
    if (options.recordId) {
      this.loadHistoryRecord(options.recordId);
    } else {
      this.loadCurrentScan();
    }
  },

  initCanvas() {
    const that = this;
    const query = wx.createSelectorQuery();
    query.select('.hidden-canvas').fields({ node: true, size: true }).exec((res) => {
      if (res[0] && res[0].node) {
        that.canvas = res[0].node;
        that.canvasCtx = that.canvas.getContext('2d');
        that.setData({ canvasReady: true });
      }
    });
  },

  loadHistoryRecord(recordId) {
    const records = getRecords();
    const record = records.find(r => r.id === recordId);
    if (record) {
      this.setData({
        pages: record.pages,
        currentIndex: 0,
        currentImage: record.pages[0].localImagePath,
        filterType: record.pages[0].filterType || 'enhanced',
        isMultiPage: record.pages.length > 1,
        isHistory: true,
        recordId: record.id
      });
    }
  },

  loadCurrentScan() {
    const app = getApp();
    const scan = app.globalData.currentScan;
    if (!scan || !scan.pages || !scan.pages.length) {
      wx.navigateBack();
      return;
    }
    this.setData({
      pages: scan.pages,
      currentIndex: 0,
      currentImage: scan.pages[0].tempPath,
      filterType: scan.pages[0].filterType || 'enhanced',
      isMultiPage: scan.pages.length > 1 || scan.multiPageMode
    });
  },

  onSwitchPage(e) {
    const { index } = e.detail || e.currentTarget.dataset;
    const page = this.data.pages[index];
    if (!page) return;
    this.setData({
      currentIndex: index,
      currentImage: page.tempPath || page.localImagePath,
      filterType: page.filterType || 'enhanced'
    });
  },

  onSelectFilter(e) {
    const { type } = e.detail || e.currentTarget.dataset;
    this.setData({ filterType: type });
    const pages = this.data.pages;
    pages[this.data.currentIndex].filterType = type;
    this.setData({ pages });
  },

  onToggleCrop() {
    this.setData({ showCrop: !this.data.showCrop });
  },

  onCropChange(e) {
    const pages = this.data.pages;
    pages[this.data.currentIndex].cropPoints = e.detail.points;
    this.setData({ pages });
  },

  onDeletePage() {
    const { currentIndex, pages } = this.data;
    if (pages.length <= 1) {
      wx.navigateBack();
      return;
    }
    pages.splice(currentIndex, 1);
    const newIndex = Math.min(currentIndex, pages.length - 1);
    const page = pages[newIndex];
    this.setData({
      pages,
      currentIndex: newIndex,
      currentImage: page.tempPath || page.localImagePath,
      filterType: page.filterType || 'enhanced',
      isMultiPage: pages.length > 1
    });
  },

  onContinueScan() {
    const app = getApp();
    app.globalData.currentScan = {
      pages: this.data.pages,
      multiPageMode: true
    };
    wx.navigateTo({ url: '/pages/camera/camera' });
  },

  onSave() {
    const itemList = ['保存当前页到相册', '导出为 PDF'];
    if (this.data.pages.length > 1) {
      itemList.push('保存全部页到相册');
    }

    wx.showActionSheet({
      itemList,
      success: (res) => {
        if (res.tapIndex === 0) this.saveToAlbum();
        else if (res.tapIndex === 1) this.exportPDF();
        else if (res.tapIndex === 2) this.saveAllPagesToAlbum();
      }
    });
  },

  saveToAlbum() {
    wx.authorize({
      scope: 'scope.writePhotosAlbum',
      success: () => {
        wx.saveImageToPhotosAlbum({
          filePath: this.data.currentImage,
          success: () => {
            this.saveToHistory();
            wx.showToast({ title: '已保存到相册', icon: 'success' });
          },
          fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
        });
      },
      fail: () => {
        wx.showToast({ title: '请在设置中开启相册权限', icon: 'none' });
      }
    });
  },

  saveAllPagesToAlbum() {
    wx.authorize({
      scope: 'scope.writePhotosAlbum',
      success: () => {
        const paths = this.data.pages.map(p => p.tempPath || p.localImagePath);
        const { saveAllToAlbum } = require('../../utils/pdf-gen');
        saveAllToAlbum(paths).then(() => {
          this.saveToHistory();
          wx.showToast({ title: '已保存全部到相册', icon: 'success' });
        }).catch(() => {
          wx.showToast({ title: '部分保存失败', icon: 'none' });
        });
      },
      fail: () => {
        wx.showToast({ title: '请在设置中开启相册权限', icon: 'none' });
      }
    });
  },

  // Canvas 压缩图片，返回小尺寸的 temp path
  compressImage(imagePath, maxDim) {
    return new Promise((resolve, reject) => {
      const dim = maxDim || 1240;
      const canvas = wx.createOffscreenCanvas({ type: '2d' });
      const ctx = canvas.getContext('2d');
      const img = canvas.createImage();
      img.onload = () => {
        const scale = Math.min(dim / img.width, dim / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        wx.canvasToTempFilePath({
          canvas,
          fileType: 'jpg',
          quality: 0.7,
          success: (res) => resolve(res.tempFilePath),
          fail: reject
        });
      };
      img.onerror = reject;
      img.src = imagePath;
    });
  },

  async exportPDF() {
    wx.showLoading({ title: '生成 PDF...' });
    try {
      const paths = this.data.pages.map(p => p.tempPath || p.localImagePath);

      // Canvas 压缩每张图片到 1240px，避免内存溢出
      const compressed = [];
      for (const p of paths) {
        const small = await this.compressImage(p, 1240);
        compressed.push(small);
      }

      const pdfPath = await generatePDF(compressed);
      wx.hideLoading();

      if (pdfPath) {
        this.saveToHistory();
        wx.openDocument({
          filePath: pdfPath,
          showMenu: true,
          success: () => wx.showToast({ title: 'PDF 已生成', icon: 'success' }),
          fail: () => wx.showToast({ title: '请从相册查看', icon: 'none' })
        });
      } else {
        wx.showToast({ title: 'PDF 生成失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('PDF export error:', err);
      wx.showToast({ title: 'PDF 生成失败，请保存到相册', icon: 'none' });
    }
  },

  saveToHistory() {
    const pages = this.data.pages.map(p => ({
      pageId: 'p' + Date.now() + Math.random().toString(36).slice(2),
      localImagePath: saveImageFile(p.tempPath),
      filterType: p.filterType || 'enhanced',
      cropPoints: p.cropPoints || null
    }));
    return saveRecord({ pages });
  },

  onDeleteFromStrip(e) {
    const { index } = e.detail;
    const pages = this.data.pages;
    if (pages.length <= 1) return;
    pages.splice(index, 1);
    const newIndex = Math.min(this.data.currentIndex, pages.length - 1);
    const page = pages[newIndex];
    this.setData({
      pages,
      currentIndex: newIndex,
      currentImage: page.tempPath || page.localImagePath,
      filterType: page.filterType || 'enhanced',
      isMultiPage: pages.length > 1
    });
  }
});
