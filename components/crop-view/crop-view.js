Component({
  properties: {
    src: {
      type: String,
      value: ''
    },
    points: {
      type: Array,
      value: null
    }
  },

  data: {
    corners: [],
    dragging: -1
  },

  lifetimes: {
    attached() {
      this.initCorners();
    }
  },

  observers: {
    'src, points'(src, points) {
      if (src) this.initCorners();
    }
  },

  methods: {
    initCorners() {
      const query = this.createSelectorQuery();
      query.select('.crop-canvas').boundingClientRect();
      query.exec((res) => {
        if (!res[0]) return;
        const { width, height } = res[0];
        const margin = 0.1;
        const corners = this.properties.points || [
          { x: width * margin, y: height * margin },
          { x: width * (1 - margin), y: height * margin },
          { x: width * (1 - margin), y: height * (1 - margin) },
          { x: width * margin, y: height * (1 - margin) }
        ];
        this.setData({ corners, canvasW: width, canvasH: height });
        this.draw();
      });
    },

    draw() {
      const query = this.createSelectorQuery();
      query.select('.crop-canvas').fields({ node: true, size: true });
      query.exec((res) => {
        if (!res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const { width, height } = res[0];
        const { corners } = this.data;

        canvas.width = width;
        canvas.height = height;

        // 绘制半透明遮罩
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, width, height);

        // 清除裁剪区域的遮罩
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < 4; i++) {
          ctx.lineTo(corners[i].x, corners[i].y);
        }
        ctx.closePath();
        ctx.clip();
        ctx.clearRect(0, 0, width, height);
        ctx.restore();

        // 绘制裁剪边框
        ctx.strokeStyle = '#07c160';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < 4; i++) {
          ctx.lineTo(corners[i].x, corners[i].y);
        }
        ctx.closePath();
        ctx.stroke();

        // 绘制角点控制点
        const r = 12;
        corners.forEach((c, i) => {
          ctx.fillStyle = i === this.data.dragging ? '#07c160' : '#fff';
          ctx.strokeStyle = '#07c160';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      });
    },

    onTouchStart(e) {
      const { x, y } = e.touches[0];
      const { corners } = this.data;
      const hitRadius = 24;

      const idx = corners.findIndex(c => {
        const dx = c.x - x, dy = c.y - y;
        return Math.sqrt(dx * dx + dy * dy) < hitRadius;
      });

      if (idx >= 0) {
        this.setData({ dragging: idx });
        this.draw();
      }
    },

    onTouchMove(e) {
      if (this.data.dragging < 0) return;

      const { x, y } = e.touches[0];
      const { canvasW, canvasH } = this.data;
      const corners = [...this.data.corners];
      corners[this.data.dragging] = {
        x: Math.max(0, Math.min(canvasW, x)),
        y: Math.max(0, Math.min(canvasH, y))
      };
      this.setData({ corners });
      this.draw();
    },

    onTouchEnd() {
      if (this.data.dragging >= 0) {
        this.triggerEvent('change', { points: this.data.corners });
        this.setData({ dragging: -1 });
        this.draw();
      }
    }
  }
});
