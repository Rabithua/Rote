const http = require('http');
const fs = require('fs');
const path = require('path');

// 创建下载目录（如果不存在）
const downloadDir = path.join(__dirname, 'cat_gifs');
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir);
}

// 下载单个文件的函数
function downloadFile(fileNumber) {
  // 将数字格式化为4位数字的字符串（例如：0 → 0000, 7 → 0007）
  const formattedNumber = fileNumber.toString().padStart(4, '0');
  const url = `http://motions.cat/gif/nhn/${formattedNumber}.gif`;
  const filePath = path.join(downloadDir, `${formattedNumber}.gif`);

  return new Promise((resolve, reject) => {
    // 创建HTTP请求
    http.get(url, (response) => {
      // 检查请求是否成功
      if (response.statusCode !== 200) {
        reject(new Error(`下载失败，状态码: ${response.statusCode} 对于文件 ${formattedNumber}.gif`));
        return;
      }

      // 创建文件写入流
      const fileStream = fs.createWriteStream(filePath);

      // 将响应数据写入文件
      response.pipe(fileStream);

      // 文件下载完成
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`成功下载: ${formattedNumber}.gif`);
        resolve();
      });

    }).on('error', (err) => {
      // 删除不完整的文件（如果下载失败）
      fs.unlink(filePath, () => { });
      console.error(`下载 ${formattedNumber}.gif 时出错:`, err.message);
      reject(err);
    });
  });
}

// 顺序下载所有文件
async function downloadAllFiles() {
  console.log('开始下载猫咪GIF文件...');

  // 总文件数
  const total = 169; // 从0到168，共169个文件
  let completed = 0;
  let failed = 0;

  for (let i = 0; i <= 168; i++) {
    try {
      await downloadFile(i);
      completed++;
    } catch (error) {
      failed++;
      console.error(`文件 ${i} 下载失败:`, error.message);
    }

    // 显示进度
    console.log(`进度: ${completed + failed}/${total} (成功: ${completed}, 失败: ${failed})`);
  }

  console.log(`下载完成! 成功: ${completed}, 失败: ${failed}`);
}

// 开始下载
downloadAllFiles().catch(console.error);

