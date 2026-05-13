/**
 * 最小 PDF 生成器
 * 将图片嵌入为 PDF pages，无需第三方库
 */

function encodeUTF8(str) {
  return unescape(encodeURIComponent(str));
}

function generatePDF(imagePaths, pageWidth, pageHeight) {
  const pw = pageWidth || 595;   // A4 width in points (72dpi)
  const ph = pageHeight || 842;  // A4 height

  const objects = [];
  const offsets = [];
  let offset = 0;

  // 写入函数
  let pdf = '';

  function write(str) {
    offsets.push(offset);
    pdf += str;
    offset += str.length;
  }

  function writeLine(str) {
    write(str + '\n');
  }

  // PDF Header
  writeLine('%PDF-1.4');

  // 为每个图片创建 XObject
  const xObjects = [];

  for (let i = 0; i < imagePaths.length; i++) {
    // 读取图片数据
    // 注意：微信小程序中，我们通过文件系统读取
    const fs = wx.getFileSystemManager();
    let imageData;
    let imgW, imgH;

    try {
      // 使用 base64 编码图片
      const base64 = fs.readFileSync(imagePaths[i], 'base64');
      imageData = base64;

      // 获取图片信息需要通过 image 标签，这里使用默认尺寸
      imgW = pw;
      imgH = ph * pw / imgW;
      if (!imgH || imgH > ph) {
        imgH = ph;
        imgW = pw * ph / imgH;
      }
    } catch (e) {
      continue;
    }

    const streamObjId = 3 + i * 4;
    const xobjObjId = streamObjId + 1;

    // Image stream object
    offsets.push(offset);
    writeLine(`${streamObjId} 0 obj`);
    writeLine(`<< /Type /XObject /Subtype /Image`);
    writeLine(`   /Width ${Math.round(imgW)} /Height ${Math.round(imgH)}`);
    writeLine(`   /ColorSpace /DeviceRGB /BitsPerComponent 8`);
    writeLine(`   /Filter /DCTDecode`);
    writeLine(`   /Length ${imageData.length}`);
    writeLine(`>>`);
    writeLine(`stream`);
    write(imageData + '\n');
    writeLine(`endstream`);
    writeLine(`endobj`);

    xObjects.push({ name: `/Im${i}`, objId: xobjObjId });
  }

  // Pages
  const pagesObjId = 1;
  offsets.unshift(0); // placeholder for header offset

  // 每个 page object
  const pageObjIds = [];

  for (let i = 0; i < imagePaths.length; i++) {
    const pageObjId = 3 + i * 4 + 2;
    pageObjIds.push(pageObjId);

    const streamObjId = 3 + i * 4;
    const imgW = pw;
    const imgH = ph;

    offsets.push(offset);
    writeLine(`${pageObjId} 0 obj`);
    writeLine(`<< /Type /Page`);
    writeLine(`   /Parent ${pagesObjId} 0 R`);
    writeLine(`   /MediaBox [0 0 ${Math.round(imgW)} ${Math.round(imgH)}]`);
    writeLine(`   /Contents ${streamObjId + 1} 0 R`);
    writeLine(`   /Resources << /XObject << /Im0 ${streamObjId} 0 R >> >>`);
    writeLine(`>>`);
    writeLine(`endobj`);

    // Content stream
    offsets.push(offset);
    writeLine(`${streamObjId + 1} 0 obj`);
    writeLine(`<< /Length 44 >>`);
    writeLine(`stream`);
    writeLine(`q ${Math.round(imgW)} 0 0 ${Math.round(imgH)} 0 0 cm /Im0 Do Q`);
    writeLine(`endstream`);
    writeLine(`endobj`);
  }

  // Pages tree
  const kids = pageObjIds.map(id => `${id} 0 R`).join(' ');
  offsets.push(offset);
  writeLine(`${pagesObjId} 0 obj`);
  writeLine(`<< /Type /Pages`);
  writeLine(`   /Kids [${kids}]`);
  writeLine(`   /Count ${imagePaths.length}`);
  writeLine(`>>`);
  writeLine(`endobj`);

  // Catalog
  const catalogObjId = 2;
  offsets.push(offset);
  writeLine(`${catalogObjId} 0 obj`);
  writeLine(`<< /Type /Catalog /Pages ${pagesObjId} 0 R >>`);
  writeLine(`endobj`);

  // xref table
  const xrefOffset = offset;
  writeLine(`xref`);
  writeLine(`0 ${offsets.length}`);
  writeLine(`0000000000 65535 f `);
  for (let i = 1; i < offsets.length; i++) {
    writeLine(String(offsets[i]).padStart(10, '0') + ' 00000 n ');
  }

  // Trailer
  writeLine(`trailer`);
  writeLine(`<< /Size ${offsets.length} /Root ${catalogObjId} 0 R >>`);
  writeLine(`startxref`);
  writeLine(`${xrefOffset}`);
  writeLine(`%%EOF`);

  return pdf;
}

/**
 * 生成 PDF 并保存到文件
 * @param {string[]} imagePaths - 图片路径数组
 * @returns {Promise<string>} PDF 文件路径
 */
function generatePDFFile(imagePaths) {
  return new Promise((resolve, reject) => {
    const pdfContent = generatePDF(imagePaths);
    const fs = wx.getFileSystemManager();
    const fileName = `scan_${Date.now()}.pdf`;
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;

    fs.writeFile({
      filePath,
      data: pdfContent,
      encoding: 'utf-8',
      success: () => resolve(filePath),
      fail: reject
    });
  });
}

module.exports = { generatePDF, generatePDFFile };
