Page({
  data: {
    records: [],
    isEmpty: true
  },

  onShow() {
    this.loadRecords();
  },

  loadRecords() {
    const records = wx.getStorageSync('scanRecords') || [];
    this.setData({
      records,
      isEmpty: records.length === 0
    });
  },

  onStartScan() {
    const app = getApp();
    app.globalData.currentScan = { pages: [], multiPageMode: false };
    wx.navigateTo({ url: '/pages/camera/camera' });
  },

  onTapRecord(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/edit/edit?recordId=${id}` });
  },

  onDeleteRecord(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复',
      confirmColor: '#ee0a24',
      success: (res) => {
        if (!res.confirm) return;
        const records = this.data.records.filter(r => r.id !== id);
        wx.setStorageSync('scanRecords', records);
        this.loadRecords();
      }
    });
  }
});
