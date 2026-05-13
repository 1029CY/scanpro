/**
 * PDF 生成器
 * 输入：已压缩的小尺寸图片（通过 Canvas resize 到 1240px）
 * 输出：PDF 文件路径
 */

function generatePDF(imagePaths) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();
    const pw = 595;   // A4 width in PDF points
    const ph = 842;   // A4 height

    // 收集每页的压缩图片数据
    const pagesData = [];
    for (let i = 0; i < imagePaths.length; i++) {
      try {
        const base64 = fs.readFileSync(imagePaths[i], 'base64');
        pagesData.push({ base64, index: i });
      } catch (e) {
        // skip broken images
      }
    }

    if (pagesData.length === 0) { reject(new Error('no images')); return; }

    // 构建 PDF
    const objects = [];
    let offset = 0;
    let pdf = '';

    function write(str) {
      offset += str.length;
      pdf += str;
    }

    function writeLine(str) { write(str + '\n'); }
    function writeObj(id, content) {
      objects.push({ id, offset: offset });
      writeLine(id + ' 0 obj');
      write(content);
      writeLine('endobj');
    }

    writeLine('%PDF-1.4');

    // 图片 XObject objects
    const imgObjIds = [];
    for (const pd of pagesData) {
      const id = 3 + pd.index * 3;
      imgObjIds.push(id);
      writeObj(id,
        '<< /Type /XObject /Subtype /Image\n' +
        '   /Width 595 /Height 842\n' +
        '   /ColorSpace /DeviceRGB /BitsPerComponent 8\n' +
        '   /Filter /DCTDecode\n' +
        '   /Length ' + pd.base64.length + '\n' +
        '>>\n' +
        'stream\n' + pd.base64 + '\nendstream\n'
      );
    }

    // Page objects
    const pageObjIds = [];
    for (let i = 0; i < pagesData.length; i++) {
      const pageId = 3 + i * 3 + 1;
      const contentId = 3 + i * 3 + 2;
      const imgId = imgObjIds[i];
      pageObjIds.push(pageId);

      writeObj(pageId,
        '<< /Type /Page\n' +
        '   /Parent 1 0 R\n' +
        '   /MediaBox [0 0 ' + pw + ' ' + ph + ']\n' +
        '   /Contents ' + contentId + ' 0 R\n' +
        '   /Resources << /XObject << /Im0 ' + imgId + ' 0 R >> >>\n' +
        '>>'
      );

      const content = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
      writeObj(contentId,
        '<< /Length ' + content.length + ' >>\n' +
        'stream\n' + content + '\nendstream'
      );
    }

    // Pages tree (object 1)
    const kids = pageObjIds.map(id => id + ' 0 R').join(' ');
    writeObj(1,
      '<< /Type /Pages\n' +
      '   /Kids [' + kids + ']\n' +
      '   /Count ' + pagesData.length + '\n' +
      '>>'
    );

    // Catalog (object 2)
    writeObj(2, '<< /Type /Catalog /Pages 1 0 R >>');

    // xref
    const xrefOffset = offset;
    const total = objects.length + 1;
    writeLine('xref');
    writeLine('0 ' + total);
    writeLine('0000000000 65535 f ');
    for (const obj of objects) {
      writeLine(String(obj.offset).padStart(10, '0') + ' 00000 n ');
    }

    writeLine('trailer');
    writeLine('<< /Size ' + total + ' /Root 2 0 R >>');
    writeLine('startxref');
    writeLine('' + xrefOffset);
    writeLine('%%EOF');

    // 写入文件
    const filePath = wx.env.USER_DATA_PATH + '/scan_' + Date.now() + '.pdf';
    fs.writeFile({
      filePath,
      data: pdf,
      encoding: 'utf-8',
      success: () => resolve(filePath),
      fail: (e) => reject(e)
    });
  });
}

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

module.exports = { generatePDF, saveAllToAlbum };
