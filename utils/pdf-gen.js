/**
 * PDF 生成器 — 用 ArrayBuffer 写入，包含正确的 xref 表
 */

function strToBuf(str) {
  const buf = new ArrayBuffer(str.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) view[i] = str.charCodeAt(i) & 0xff;
  return buf;
}

function buildPDF(imagePaths) {
  const fs = wx.getFileSystemManager();

  // 读取所有图片的原始 JPEG 数据
  const images = [];
  for (const p of imagePaths) {
    try { images.push(fs.readFileSync(p)); }
    catch (e) { /* skip */ }
  }
  if (images.length === 0) return null;

  const pw = 595; // A4 width
  const ph = 842; // A4 height

  // 收集所有分段（文本和二进制），同时记录每个 object 的偏移
  const chunks = [];       // ArrayBuffer[]
  const objOffsets = {};   // objId → byte offset
  let byteOffset = 0;

  function emit(buf) {
    chunks.push(buf);
    byteOffset += buf.byteLength;
  }

  function emitStr(str) {
    emit(strToBuf(str));
  }

  function markObj(objId) {
    objOffsets[objId] = byteOffset;
  }

  // PDF header
  emitStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  // Image XObjects
  const imgObjIds = [];
  for (let i = 0; i < images.length; i++) {
    const id = 3 + i * 3;
    imgObjIds.push(id);
    markObj(id);
    emitStr(id + ' 0 obj\n');
    emitStr('<< /Type /XObject /Subtype /Image\n');
    emitStr('   /Width ' + pw + ' /Height ' + ph + '\n');
    emitStr('   /ColorSpace /DeviceRGB /BitsPerComponent 8\n');
    emitStr('   /Filter /DCTDecode\n');
    emitStr('   /Length ' + images[i].byteLength + '\n');
    emitStr('>>\nstream\n');
    emit(images[i]);
    emitStr('\nendstream\nendobj\n\n');
  }

  // Page + Content objects
  const pageObjIds = [];
  for (let i = 0; i < images.length; i++) {
    const pageId = 3 + i * 3 + 1;
    const contentId = 3 + i * 3 + 2;
    const imgId = imgObjIds[i];
    pageObjIds.push(pageId);

    // Page object
    markObj(pageId);
    emitStr(pageId + ' 0 obj\n');
    emitStr('<< /Type /Page /Parent 1 0 R\n');
    emitStr('   /MediaBox [0 0 ' + pw + ' ' + ph + ']\n');
    emitStr('   /Contents ' + contentId + ' 0 R\n');
    emitStr('   /Resources << /XObject << /Im0 ' + imgId + ' 0 R >> >>\n');
    emitStr('>>\nendobj\n\n');

    // Content stream
    const content = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
    markObj(contentId);
    emitStr(contentId + ' 0 obj\n');
    emitStr('<< /Length ' + content.length + ' >>\n');
    emitStr('stream\n' + content + '\nendstream\nendobj\n\n');
  }

  // Pages tree (object 1)
  markObj(1);
  emitStr('1 0 obj\n');
  emitStr('<< /Type /Pages\n');
  emitStr('   /Kids [' + pageObjIds.map(id => id + ' 0 R').join(' ') + ']\n');
  emitStr('   /Count ' + images.length + '\n');
  emitStr('>>\nendobj\n\n');

  // Catalog (object 2)
  markObj(2);
  emitStr('2 0 obj\n');
  emitStr('<< /Type /Catalog /Pages 1 0 R >>\n');
  emitStr('endobj\n\n');

  // xref table
  const xrefOffset = byteOffset;
  const totalObjs = Math.max(...Object.keys(objOffsets).map(Number)) + 1;
  emitStr('xref\n');
  emitStr('0 ' + (totalObjs + 1) + '\n');
  emitStr('0000000000 65535 f \n');
  for (let i = 1; i <= totalObjs; i++) {
    if (objOffsets[i] !== undefined) {
      emitStr(String(objOffsets[i]).padStart(10, '0') + ' 00000 n \n');
    } else {
      emitStr('0000000000 65535 f \n');
    }
  }

  // Trailer
  emitStr('trailer\n');
  emitStr('<< /Size ' + (totalObjs + 1) + ' /Root 2 0 R >>\n');
  emitStr('startxref\n');
  emitStr(String(xrefOffset) + '\n');
  emitStr('%%EOF\n');

  // 合并所有 chunks
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const result = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    result.set(new Uint8Array(c), pos);
    pos += c.byteLength;
  }

  return result.buffer;
}

function generatePDF(imagePaths) {
  return new Promise((resolve, reject) => {
    const pdfBuf = buildPDF(imagePaths);
    if (!pdfBuf) return reject(new Error('no images'));

    const filePath = wx.env.USER_DATA_PATH + '/scan_' + Date.now() + '.pdf';
    const fs = wx.getFileSystemManager();
    fs.writeFile({
      filePath,
      data: pdfBuf,
      success: () => resolve(filePath),
      fail: (e) => reject(e)
    });
  });
}

function saveAllToAlbum(imagePaths) {
  return new Promise((resolve) => {
    let done = 0;
    const total = imagePaths.length;
    function next(i) {
      if (i >= total) { resolve(); return; }
      wx.saveImageToPhotosAlbum({
        filePath: imagePaths[i],
        success: () => { done++; next(i + 1); },
        fail: () => { done++; next(i + 1); }
      });
    }
    total === 0 ? resolve() : next(0);
  });
}

module.exports = { generatePDF, saveAllToAlbum };
