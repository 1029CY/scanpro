Component({
  properties: {
    pages: {
      type: Array,
      value: []
    },
    current: {
      type: Number,
      value: 0
    }
  },

  methods: {
    onTap(e) {
      const { index } = e.currentTarget.dataset;
      this.triggerEvent('switch', { index });
    },

    onLongPress(e) {
      const { index } = e.currentTarget.dataset;
      wx.showModal({
        title: '删除此页？',
        confirmColor: '#ee0a24',
        success: (res) => {
          if (res.confirm) {
            this.triggerEvent('delete', { index });
          }
        }
      });
    }
  }
});
